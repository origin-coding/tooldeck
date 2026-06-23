import { readFileSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { LocalizedString, PluginManifest } from "@tooldeck/protocol";
import Ajv, { type ErrorObject } from "ajv";

import { generatePluginCommandTypes } from "./generate-command-types-core";
import { DEFAULT_PLUGIN_MANIFEST_PATH, readPluginManifest } from "./plugin-manifest";

export const DEFAULT_GENERATED_COMMANDS_PATH = path.join("src", "generated", "commands.ts");

export type PluginProjectDiagnosticSeverity = "error" | "warning";

export interface PluginProjectDiagnostic {
  severity: PluginProjectDiagnosticSeverity;
  code: string;
  message: string;
  path?: string;
}

export interface CheckPluginProjectOptions {
  manifestPath?: string;
  generatedPath?: string;
  built?: boolean;
}

export interface CheckPluginProjectResult {
  ok: boolean;
  manifest?: PluginManifest;
  manifestPath: string;
  manifestDir: string;
  diagnostics: PluginProjectDiagnostic[];
}

export interface InspectPluginProjectOptions {
  manifestPath?: string;
  generatedPath?: string;
}

export interface InspectPluginProjectResult {
  manifestPath: string;
  manifestDir: string;
  plugin?: {
    id: string;
    name: string;
    version: string;
  };
  runtimeEntry?: string;
  commands: string[];
  activationEvents: string[];
  locales: LocaleInspection[];
  generated: FileInspection;
  buildOutput: FileInspection;
  packageManager?: string;
  tooldeckPackages: TooldeckPackageInspection[];
  diagnostics: PluginProjectDiagnostic[];
}

export interface LocaleInspection {
  locale: string;
  path: string;
  exists: boolean;
  missingKeys: string[];
}

export interface FileInspection {
  path: string;
  exists: boolean;
  status: string;
}

export interface TooldeckPackageInspection {
  name: string;
  version: string;
  source: "dependencies" | "devDependencies" | "peerDependencies";
}

type JsonRecord = Record<string, unknown>;

const require = createRequire(import.meta.url);
const manifestSchema = JSON.parse(
  readFileSync(require.resolve("@tooldeck/protocol/schema/manifest-v1.schema.json"), "utf8"),
) as object;

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  validateSchema: false,
});

const validateManifestSchema = ajv.compile<PluginManifest>(createRuntimeManifestSchema());

export async function checkPluginProject(
  options: CheckPluginProjectOptions = {},
): Promise<CheckPluginProjectResult> {
  const manifestPath = path.resolve(options.manifestPath ?? DEFAULT_PLUGIN_MANIFEST_PATH);
  const manifestDir = path.dirname(manifestPath);
  const diagnostics: PluginProjectDiagnostic[] = [];
  const manifest = await readAndValidateManifest(manifestPath, diagnostics);

  if (manifest) {
    await checkManifestSemantics(manifest, manifestPath, manifestDir, diagnostics);
    await checkGeneratedCommands(
      manifest,
      manifestDir,
      path.basename(manifestPath),
      options.generatedPath,
      diagnostics,
    );
    await checkPackageJson(manifestDir, diagnostics);

    if (options.built) {
      await checkBuiltOutput(manifest, manifestDir, diagnostics);
    }
  }

  return {
    ok: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    manifest,
    manifestPath,
    manifestDir,
    diagnostics,
  };
}

export async function inspectPluginProject(
  options: InspectPluginProjectOptions = {},
): Promise<InspectPluginProjectResult> {
  const baseCheck = await checkPluginProject({
    manifestPath: options.manifestPath,
    generatedPath: options.generatedPath,
    built: false,
  });
  const manifest = baseCheck.manifest;
  const generatedPath = path.resolve(
    baseCheck.manifestDir,
    options.generatedPath ?? DEFAULT_GENERATED_COMMANDS_PATH,
  );
  const buildOutputPath = manifest
    ? path.resolve(baseCheck.manifestDir, manifest.runtime.entry)
    : path.resolve(baseCheck.manifestDir, "dist", "index.js");
  const packageJson = await readJsonIfExists(path.join(baseCheck.manifestDir, "package.json"));

  return {
    manifestPath: baseCheck.manifestPath,
    manifestDir: baseCheck.manifestDir,
    plugin: manifest
      ? {
          id: manifest.id,
          name: renderLocalizedString(manifest.name),
          version: manifest.version,
        }
      : undefined,
    runtimeEntry: manifest?.runtime.entry,
    commands: manifest?.contributes?.commands?.map((command) => command.id) ?? [],
    activationEvents:
      manifest?.contributes?.commands?.map((command) => `onCommand:${command.id}`) ?? [],
    locales: await inspectLocales(manifest, baseCheck.manifestDir),
    generated: {
      path: generatedPath,
      exists: await pathExists(generatedPath),
      status: baseCheck.diagnostics.some((diagnostic) => diagnostic.code === "GENERATED_STALE")
        ? "stale"
        : "in sync",
    },
    buildOutput: {
      path: buildOutputPath,
      exists: await pathExists(buildOutputPath),
      status: (await pathExists(buildOutputPath)) ? "present" : "missing",
    },
    packageManager: await detectPackageManager(baseCheck.manifestDir),
    tooldeckPackages: collectTooldeckPackages(packageJson),
    diagnostics: baseCheck.diagnostics,
  };
}

export function formatPluginCheckResult(result: CheckPluginProjectResult): string {
  if (result.diagnostics.length === 0) {
    return "Plugin project check passed.";
  }

  return result.diagnostics.map(formatDiagnostic).join("\n");
}

export function formatPluginInspection(result: InspectPluginProjectResult): string {
  const lines = [
    "Tooldeck plugin inspection",
    `Manifest: ${result.manifestPath}`,
    `Plugin: ${result.plugin ? `${result.plugin.id} (${result.plugin.version})` : "unavailable"}`,
    `Name: ${result.plugin?.name ?? "unavailable"}`,
    `Runtime entry: ${result.runtimeEntry ?? "unavailable"}`,
    `Commands: ${result.commands.length ? result.commands.join(", ") : "none"}`,
    `Activation events: ${
      result.activationEvents.length ? result.activationEvents.join(", ") : "none"
    }`,
    `Generated commands: ${result.generated.status} (${result.generated.path})`,
    `Build output: ${result.buildOutput.status} (${result.buildOutput.path})`,
    `Package manager: ${result.packageManager ?? "not detected"}`,
    `Tooldeck packages: ${formatTooldeckPackages(result.tooldeckPackages)}`,
  ];

  if (result.locales.length > 0) {
    lines.push("Locales:");
    for (const locale of result.locales) {
      const status = locale.exists
        ? locale.missingKeys.length > 0
          ? `missing ${locale.missingKeys.length} key(s)`
          : "ok"
        : "missing";

      lines.push(`  - ${locale.locale}: ${status} (${locale.path})`);
    }
  }

  if (result.diagnostics.length > 0) {
    lines.push("Diagnostics:");
    lines.push(...result.diagnostics.map((diagnostic) => `  - ${formatDiagnostic(diagnostic)}`));
  }

  return lines.join("\n");
}

async function readAndValidateManifest(
  manifestPath: string,
  diagnostics: PluginProjectDiagnostic[],
): Promise<PluginManifest | undefined> {
  let text: string;

  try {
    text = await readFile(manifestPath, "utf8");
  } catch (error) {
    diagnostics.push({
      severity: "error",
      code: "MANIFEST_MISSING",
      message: `Manifest file does not exist or cannot be read: ${formatUnknownError(error)}`,
      path: manifestPath,
    });

    return undefined;
  }

  let manifest: unknown;

  try {
    manifest = JSON.parse(text);
  } catch (error) {
    diagnostics.push({
      severity: "error",
      code: "MANIFEST_INVALID_JSON",
      message: `Manifest is not valid JSON: ${formatUnknownError(error)}`,
      path: manifestPath,
    });

    return undefined;
  }

  if (!validateManifestSchema(manifest)) {
    diagnostics.push(
      ...normalizeAjvErrors(validateManifestSchema.errors ?? []).map((error) => ({
        severity: "error" as const,
        code: "MANIFEST_SCHEMA",
        message: `${error.path} ${error.message}`,
        path: manifestPath,
      })),
    );

    return undefined;
  }

  return manifest;
}

async function checkManifestSemantics(
  manifest: PluginManifest,
  manifestPath: string,
  manifestDir: string,
  diagnostics: PluginProjectDiagnostic[],
): Promise<void> {
  if (manifest.runtime.kind !== "node") {
    diagnostics.push({
      severity: "error",
      code: "RUNTIME_UNSUPPORTED",
      message: `Unsupported runtime kind: ${manifest.runtime.kind}`,
      path: manifestPath,
    });
  }

  if (path.isAbsolute(manifest.runtime.entry)) {
    diagnostics.push({
      severity: "error",
      code: "RUNTIME_ENTRY_ABSOLUTE",
      message: "manifest.runtime.entry must be relative to the manifest file.",
      path: manifestPath,
    });
  }

  if (!manifest.runtime.entry.startsWith("./") && !manifest.runtime.entry.startsWith("../")) {
    diagnostics.push({
      severity: "warning",
      code: "RUNTIME_ENTRY_RELATIVE_STYLE",
      message: "Prefer an explicit relative runtime entry such as ./dist/index.js.",
      path: manifestPath,
    });
  }

  if (!normalizePath(manifest.runtime.entry).startsWith("dist/")) {
    diagnostics.push({
      severity: "warning",
      code: "RUNTIME_ENTRY_DIST",
      message: "The recommended runtime entry points to a built file under ./dist.",
      path: manifestPath,
    });
  }

  checkUniqueCommandIds(manifest, manifestPath, diagnostics);
  checkSupportedSchemaExtensions(manifest, manifestPath, diagnostics);
  await checkLocales(manifest, manifestDir, diagnostics);
}

function checkUniqueCommandIds(
  manifest: PluginManifest,
  manifestPath: string,
  diagnostics: PluginProjectDiagnostic[],
): void {
  const seen = new Set<string>();

  for (const command of manifest.contributes?.commands ?? []) {
    if (seen.has(command.id)) {
      diagnostics.push({
        severity: "error",
        code: "COMMAND_ID_DUPLICATE",
        message: `Command id is duplicated in this manifest: ${command.id}`,
        path: manifestPath,
      });
    }

    seen.add(command.id);
  }
}

function checkSupportedSchemaExtensions(
  manifest: PluginManifest,
  manifestPath: string,
  diagnostics: PluginProjectDiagnostic[],
): void {
  manifest.contributes?.commands?.forEach((command, commandIndex) => {
    const inputSchema = command.inputSchema;

    if (isRecord(inputSchema)) {
      checkRootInputSchemaUi(inputSchema, manifestPath, commandIndex, diagnostics);
      walkSchema(inputSchema, (schema, schemaPath) => {
        checkSchemaI18n(schema, manifestPath, commandIndex, schemaPath, diagnostics);
      });

      const properties = isRecord(inputSchema.properties) ? inputSchema.properties : {};

      for (const [propertyName, propertySchema] of Object.entries(properties)) {
        if (!isRecord(propertySchema)) {
          continue;
        }

        checkInputFieldUi(
          propertySchema,
          manifestPath,
          commandIndex,
          propertyName,
          diagnostics,
        );
      }
    }

    const outputSchema = command.outputSchema;

    if (isRecord(outputSchema) && "x-ui" in outputSchema) {
      diagnostics.push({
        severity: "error",
        code: "OUTPUT_SCHEMA_X_UI",
        message: `Command ${command.id} outputSchema must not use x-ui.`,
        path: manifestPath,
      });
    }
  });
}

function checkRootInputSchemaUi(
  inputSchema: JsonRecord,
  manifestPath: string,
  commandIndex: number,
  diagnostics: PluginProjectDiagnostic[],
): void {
  const ui = inputSchema["x-ui"];

  if (ui === undefined) {
    return;
  }

  if (!isRecord(ui)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_SCHEMA_X_UI",
      message: `Command at index ${commandIndex} inputSchema.x-ui must be an object.`,
      path: manifestPath,
    });

    return;
  }

  for (const key of Object.keys(ui)) {
    if (key !== "fieldOrder") {
      diagnostics.push({
        severity: "error",
        code: "INPUT_SCHEMA_X_UI",
        message: `Unsupported inputSchema.x-ui property: ${key}`,
        path: manifestPath,
      });
    }
  }

  const fieldOrder = ui.fieldOrder;

  if (fieldOrder === undefined) {
    return;
  }

  if (!Array.isArray(fieldOrder)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_SCHEMA_FIELD_ORDER",
      message: "inputSchema.x-ui.fieldOrder must be an array.",
      path: manifestPath,
    });

    return;
  }

  const properties = isRecord(inputSchema.properties) ? inputSchema.properties : {};
  const propertyKeys = new Set(Object.keys(properties));
  const seen = new Set<string>();

  for (const fieldName of fieldOrder) {
    if (typeof fieldName !== "string" || !fieldName) {
      diagnostics.push({
        severity: "error",
        code: "INPUT_SCHEMA_FIELD_ORDER",
        message: "inputSchema.x-ui.fieldOrder must contain non-empty field names.",
        path: manifestPath,
      });
      continue;
    }

    if (seen.has(fieldName)) {
      diagnostics.push({
        severity: "error",
        code: "INPUT_SCHEMA_FIELD_ORDER",
        message: `inputSchema.x-ui.fieldOrder duplicates field: ${fieldName}`,
        path: manifestPath,
      });
      continue;
    }

    seen.add(fieldName);

    if (!propertyKeys.has(fieldName)) {
      diagnostics.push({
        severity: "error",
        code: "INPUT_SCHEMA_FIELD_ORDER",
        message: `inputSchema.x-ui.fieldOrder references unknown field: ${fieldName}`,
        path: manifestPath,
      });
    }
  }
}

function checkSchemaI18n(
  schema: JsonRecord,
  manifestPath: string,
  commandIndex: number,
  schemaPath: string,
  diagnostics: PluginProjectDiagnostic[],
): void {
  const i18n = schema["x-i18n"];

  if (i18n === undefined) {
    return;
  }

  if (!isRecord(i18n)) {
    diagnostics.push({
      severity: "error",
      code: "SCHEMA_X_I18N",
      message: `Command at index ${commandIndex} ${schemaPath}.x-i18n must be an object.`,
      path: manifestPath,
    });

    return;
  }

  for (const key of Object.keys(i18n)) {
    if (key !== "title" && key !== "description" && key !== "enumLabels") {
      diagnostics.push({
        severity: "error",
        code: "SCHEMA_X_I18N",
        message: `Unsupported x-i18n property: ${key}`,
        path: manifestPath,
      });
    }
  }
}

function checkInputFieldUi(
  schema: JsonRecord,
  manifestPath: string,
  commandIndex: number,
  propertyName: string,
  diagnostics: PluginProjectDiagnostic[],
): void {
  const ui = schema["x-ui"];

  if (ui === undefined) {
    return;
  }

  if (!isRecord(ui)) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_FIELD_X_UI",
      message: `Command at index ${commandIndex} field ${propertyName} x-ui must be an object.`,
      path: manifestPath,
    });

    return;
  }

  const control = ui.control;

  if (
    control !== "text" &&
    control !== "textarea" &&
    control !== "number" &&
    control !== "checkbox" &&
    control !== "radio" &&
    control !== "select" &&
    control !== "checkboxGroup" &&
    control !== "multiSelect"
  ) {
    diagnostics.push({
      severity: "error",
      code: "INPUT_FIELD_X_UI",
      message: `Unsupported x-ui.control on ${propertyName}: ${String(control)}`,
      path: manifestPath,
    });
  }
}

async function checkLocales(
  manifest: PluginManifest,
  manifestDir: string,
  diagnostics: PluginProjectDiagnostic[],
): Promise<void> {
  const keys = collectManifestLocalizationKeys(manifest);

  if (keys.size === 0) {
    return;
  }

  if (!manifest.locales || Object.keys(manifest.locales).length === 0) {
    diagnostics.push({
      severity: "error",
      code: "LOCALES_MISSING",
      message: "Manifest uses localization keys but does not declare locale files.",
    });

    return;
  }

  for (const [locale, localePath] of Object.entries(manifest.locales)) {
    if (!localePath) {
      diagnostics.push({
        severity: "error",
        code: "LOCALE_FILE_MISSING",
        message: `Locale ${locale} does not declare a locale file path.`,
      });
      continue;
    }

    const resolvedPath = path.resolve(manifestDir, localePath);
    const resource = await readJsonIfExists(resolvedPath);

    if (!resource) {
      diagnostics.push({
        severity: "error",
        code: "LOCALE_FILE_MISSING",
        message: `Locale file for ${locale} is missing or invalid JSON.`,
        path: resolvedPath,
      });
      continue;
    }

    for (const key of keys) {
      if (typeof resource[key] !== "string") {
        diagnostics.push({
          severity: "error",
          code: "LOCALE_KEY_MISSING",
          message: `Locale ${locale} does not define key: ${key}`,
          path: resolvedPath,
        });
      }
    }
  }
}

async function checkGeneratedCommands(
  manifest: PluginManifest,
  manifestDir: string,
  sourceLabel: string,
  generatedPath: string | undefined,
  diagnostics: PluginProjectDiagnostic[],
): Promise<void> {
  const resolvedPath = path.resolve(manifestDir, generatedPath ?? DEFAULT_GENERATED_COMMANDS_PATH);
  let expected: string;

  try {
    expected = await generatePluginCommandTypes(manifest, {
      cwd: manifestDir,
      sourceLabel,
    });
  } catch (error) {
    diagnostics.push({
      severity: "error",
      code: "GENERATED_TYPES_FAILED",
      message: `Could not generate command types from manifest: ${formatUnknownError(error)}`,
      path: resolvedPath,
    });

    return;
  }

  let current: string;

  try {
    current = await readFile(resolvedPath, "utf8");
  } catch {
    diagnostics.push({
      severity: "error",
      code: "GENERATED_MISSING",
      message: "Generated command types file is missing. Run tooldeck-plugin generate.",
      path: resolvedPath,
    });

    return;
  }

  if (normalizeNewlines(current) !== normalizeNewlines(expected)) {
    diagnostics.push({
      severity: "error",
      code: "GENERATED_STALE",
      message: "Generated command types are out of sync. Run tooldeck-plugin generate.",
      path: resolvedPath,
    });
  }
}

async function checkPackageJson(
  manifestDir: string,
  diagnostics: PluginProjectDiagnostic[],
): Promise<void> {
  const packageJsonPath = path.join(manifestDir, "package.json");
  const packageJson = await readJsonIfExists(packageJsonPath);

  if (!packageJson) {
    diagnostics.push({
      severity: "error",
      code: "PACKAGE_JSON_MISSING",
      message: "Plugin project package.json is missing or invalid JSON.",
      path: packageJsonPath,
    });

    return;
  }

  const scripts = isRecord(packageJson.scripts) ? packageJson.scripts : {};

  for (const scriptName of ["generate", "check", "build"]) {
    if (typeof scripts[scriptName] !== "string") {
      diagnostics.push({
        severity: "error",
        code: "PACKAGE_SCRIPT_MISSING",
        message: `package.json scripts.${scriptName} is required.`,
        path: packageJsonPath,
      });
    }
  }

  const dependencies = getPackageDependencyMap(packageJson);

  for (const packageName of ["@tooldeck/sdk-node", "@tooldeck/plugin-tools"]) {
    if (!dependencies.has(packageName)) {
      diagnostics.push({
        severity: "error",
        code: "PACKAGE_DEPENDENCY_MISSING",
        message: `package.json must depend on ${packageName}.`,
        path: packageJsonPath,
      });
    }
  }
}

async function checkBuiltOutput(
  manifest: PluginManifest,
  manifestDir: string,
  diagnostics: PluginProjectDiagnostic[],
): Promise<void> {
  const entryPath = path.resolve(manifestDir, manifest.runtime.entry);

  if (!(await pathExists(entryPath))) {
    diagnostics.push({
      severity: "error",
      code: "BUILT_ENTRY_MISSING",
      message: "manifest.runtime.entry does not point to an existing built file.",
      path: entryPath,
    });

    return;
  }

  let moduleExports: unknown;

  try {
    moduleExports = await import(`${pathToFileURL(entryPath).href}?tooldeck-check=${Date.now()}`);
  } catch (error) {
    diagnostics.push({
      severity: "error",
      code: "BUILT_ENTRY_IMPORT_FAILED",
      message: `Built runtime entry is not ESM-loadable: ${formatUnknownError(error)}`,
      path: entryPath,
    });

    return;
  }

  if (!isRecord(moduleExports) || !isRecord(moduleExports.default)) {
    diagnostics.push({
      severity: "error",
      code: "BUILT_PLUGIN_DEFAULT_EXPORT",
      message: "Built runtime entry must default export a Tooldeck plugin object.",
      path: entryPath,
    });

    return;
  }

  if (typeof moduleExports.default.activate !== "function") {
    diagnostics.push({
      severity: "error",
      code: "BUILT_PLUGIN_DEFAULT_EXPORT",
      message: "Built default export must expose an activate(ctx) function.",
      path: entryPath,
    });
  }
}

async function inspectLocales(
  manifest: PluginManifest | undefined,
  manifestDir: string,
): Promise<LocaleInspection[]> {
  if (!manifest?.locales) {
    return [];
  }

  const keys = collectManifestLocalizationKeys(manifest);
  const locales: LocaleInspection[] = [];

  for (const [locale, localePath] of Object.entries(manifest.locales)) {
    if (!localePath) {
      locales.push({
        locale,
        path: path.resolve(manifestDir, "<missing-locale-path>"),
        exists: false,
        missingKeys: [...keys],
      });
      continue;
    }

    const resolvedPath = path.resolve(manifestDir, localePath);
    const resource = await readJsonIfExists(resolvedPath);
    const missingKeys = resource
      ? [...keys].filter((key) => typeof resource[key] !== "string")
      : [...keys];

    locales.push({
      locale,
      path: resolvedPath,
      exists: Boolean(resource),
      missingKeys,
    });
  }

  return locales;
}

function collectManifestLocalizationKeys(manifest: PluginManifest): Set<string> {
  const keys = new Set<string>();

  collectLocalizedStringKey(manifest.name, keys);
  collectLocalizedStringKey(manifest.description, keys);

  for (const command of manifest.contributes?.commands ?? []) {
    collectLocalizedStringKey(command.title, keys);
    collectLocalizedStringKey(command.description, keys);
    collectSchemaLocalizationKeys(command.inputSchema, keys);
    collectSchemaLocalizationKeys(command.outputSchema, keys);
  }

  return keys;
}

function collectSchemaLocalizationKeys(value: unknown, keys: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSchemaLocalizationKeys(item, keys);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const i18n = value["x-i18n"];

  if (isRecord(i18n)) {
    for (const i18nValue of Object.values(i18n)) {
      if (typeof i18nValue === "string") {
        keys.add(i18nValue);
      } else if (isRecord(i18nValue)) {
        for (const nestedValue of Object.values(i18nValue)) {
          if (typeof nestedValue === "string") {
            keys.add(nestedValue);
          }
        }
      }
    }
  }

  const ui = value["x-ui"];

  if (isRecord(ui)) {
    collectLocalizedStringKey(ui.placeholder, keys);
  }

  for (const item of Object.values(value)) {
    collectSchemaLocalizationKeys(item, keys);
  }
}

function collectLocalizedStringKey(value: unknown, keys: Set<string>): void {
  if (isRecord(value) && typeof value.key === "string") {
    keys.add(value.key);
  }
}

function renderLocalizedString(value: LocalizedString): string {
  return typeof value === "string" ? value : value.default;
}

function walkSchema(value: unknown, visit: (schema: JsonRecord, schemaPath: string) => void): void {
  walkSchemaInner(value, "$", visit);
}

function walkSchemaInner(
  value: unknown,
  schemaPath: string,
  visit: (schema: JsonRecord, schemaPath: string) => void,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkSchemaInner(item, `${schemaPath}[${index}]`, visit));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  visit(value, schemaPath);

  for (const [key, item] of Object.entries(value)) {
    walkSchemaInner(item, `${schemaPath}.${key}`, visit);
  }
}

async function detectPackageManager(startDir: string): Promise<string | undefined> {
  let currentDir = startDir;

  while (true) {
    if (await pathExists(path.join(currentDir, "pnpm-lock.yaml"))) {
      return "pnpm";
    }

    if (await pathExists(path.join(currentDir, "package-lock.json"))) {
      return "npm";
    }

    if (await pathExists(path.join(currentDir, "yarn.lock"))) {
      return "yarn";
    }

    if ((await pathExists(path.join(currentDir, "bun.lockb"))) || (await pathExists(path.join(currentDir, "bun.lock")))) {
      return "bun";
    }

    const parent = path.dirname(currentDir);

    if (parent === currentDir) {
      return undefined;
    }

    currentDir = parent;
  }
}

function collectTooldeckPackages(packageJson: JsonRecord | undefined): TooldeckPackageInspection[] {
  if (!packageJson) {
    return [];
  }

  return ["dependencies", "devDependencies", "peerDependencies"].flatMap((source) => {
    const dependencies = packageJson[source];

    if (!isRecord(dependencies)) {
      return [];
    }

    return Object.entries(dependencies)
      .filter(([name]) => name.startsWith("@tooldeck/"))
      .map(([name, version]) => ({
        name,
        version: String(version),
        source: source as TooldeckPackageInspection["source"],
      }));
  });
}

function getPackageDependencyMap(packageJson: JsonRecord): Map<string, string> {
  const dependencies = new Map<string, string>();

  for (const source of ["dependencies", "devDependencies", "peerDependencies"]) {
    const values = packageJson[source];

    if (!isRecord(values)) {
      continue;
    }

    for (const [name, version] of Object.entries(values)) {
      dependencies.set(name, String(version));
    }
  }

  return dependencies;
}

async function readJsonIfExists(jsonPath: string): Promise<JsonRecord | undefined> {
  try {
    const text = await readFile(jsonPath, "utf8");
    const parsed: unknown = JSON.parse(text);

    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);

    return true;
  } catch {
    return false;
  }
}

function formatDiagnostic(diagnostic: PluginProjectDiagnostic): string {
  const prefix = diagnostic.severity === "error" ? "error" : "warning";
  const location = diagnostic.path ? ` (${diagnostic.path})` : "";

  return `[${prefix}] ${diagnostic.code}: ${diagnostic.message}${location}`;
}

function formatTooldeckPackages(packages: TooldeckPackageInspection[]): string {
  if (packages.length === 0) {
    return "none";
  }

  return packages.map((item) => `${item.name}@${item.version}`).join(", ");
}

function normalizeAjvErrors(errors: ErrorObject[]): {
  path: string;
  message: string;
}[] {
  return errors.map((error) => ({
    path: error.instancePath || "/",
    message: error.message ?? "failed validation",
  }));
}

function normalizeNewlines(value: string): string {
  return value.replaceAll("\r\n", "\n");
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createRuntimeManifestSchema(): object {
  const schema = structuredClone(manifestSchema) as {
    definitions?: {
      tooldeckInputJsonSchema?: unknown;
      tooldeckJsonSchema?: unknown;
    };
  };

  if (schema.definitions) {
    schema.definitions.tooldeckInputJsonSchema = {
      type: "object",
      description:
        "A command input JSON Schema object. Full JSON Schema validation is deferred to command input handling.",
    };
    schema.definitions.tooldeckJsonSchema = {
      type: "object",
      description:
        "A JSON Schema object. Full JSON Schema validation is deferred to command input handling.",
    };
  }

  return schema;
}

export async function readPluginProjectManifest(options: { manifestPath?: string } = {}) {
  return readPluginManifest(options);
}
