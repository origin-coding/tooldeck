import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_TEMPLATE = "plugin-node-vite";
const TYPESCRIPT_VERSION = "^6.0.0";
const VITE_VERSION = "^8.0.0";
const VITEST_VERSION = "^4.0.0";
const idPattern = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

export interface CreatePluginProjectOptions {
  cwd?: string;
  name: string;
  pluginId?: string;
  pluginName?: string;
  commandId?: string;
  template?: string;
  force?: boolean;
}

export interface CreatePluginTemplateData {
  projectName: string;
  packageName: string;
  pluginId: string;
  pluginName: string;
  pluginDescription: string;
  commandId: string;
  commandIdKey: string;
  commandInputTypeName: string;
  commandTitle: string;
  commandDescription: string;
  tooldeckVersion: string;
  typescriptVersion: string;
  viteVersion: string;
  vitestVersion: string;
}

export interface CreatePluginProjectResult {
  projectDir: string;
  template: string;
  data: CreatePluginTemplateData;
  files: string[];
}

type EtaModule = {
  Eta?: new (config?: { autoEscape?: boolean }) => {
    renderString(template: string, data: object): string;
  };
  renderString?: (template: string, data: object) => string;
};

export async function createPluginProject(
  options: CreatePluginProjectOptions,
): Promise<CreatePluginProjectResult> {
  const template = options.template ?? DEFAULT_TEMPLATE;

  if (template !== DEFAULT_TEMPLATE) {
    throw new Error(`Unsupported template: ${template}. Only ${DEFAULT_TEMPLATE} is available.`);
  }

  const cwd = path.resolve(options.cwd ?? process.cwd());
  const data = createTemplateData(options.name, options);
  const projectDir = path.resolve(cwd, options.name);

  await assertWritableTarget(projectDir, options.force ?? false);

  const templateDir = getTemplateDir(template);
  const files = await renderTemplateDirectory(templateDir, projectDir, projectDir, data);

  return {
    projectDir,
    template,
    data,
    files,
  };
}

export function createTemplateData(
  projectName: string,
  options: Pick<CreatePluginProjectOptions, "pluginId" | "pluginName" | "commandId"> = {},
): CreatePluginTemplateData {
  const packageName = normalizePackageName(path.basename(projectName));
  const pluginSegment = packageName.replace(/^@[^/]+\//, "");
  const pluginId = options.pluginId ?? `dev.tooldeck.${pluginSegment}`;
  const pluginName = options.pluginName ?? titleCase(pluginSegment);
  const commandId = options.commandId ?? `${pluginSegment}.echo`;

  validateId("Plugin id", pluginId);
  validateId("Command id", commandId);

  return {
    projectName,
    packageName,
    pluginId,
    pluginName,
    pluginDescription: `${pluginName} commands for Tooldeck.`,
    commandId,
    commandIdKey: camelCase(commandId),
    commandInputTypeName: `${pascalCase(commandId)}Input`,
    commandTitle: "Echo Text",
    commandDescription: "Return the provided text.",
    tooldeckVersion: `^${getCreatePluginPackageVersion()}`,
    typescriptVersion: TYPESCRIPT_VERSION,
    viteVersion: VITE_VERSION,
    vitestVersion: VITEST_VERSION,
  };
}

function getCreatePluginPackageVersion(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(currentDir, "..", "package.json"),
    path.resolve(currentDir, "..", "..", "package.json"),
  ];

  for (const packageJsonPath of candidates) {
    if (!existsSync(packageJsonPath)) {
      continue;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      name?: unknown;
      version?: unknown;
    };

    if (packageJson.name === "@tooldeck/create-plugin" && typeof packageJson.version === "string") {
      return packageJson.version;
    }
  }

  throw new Error(
    `Could not resolve @tooldeck/create-plugin package version. Checked: ${candidates.join(", ")}`,
  );
}

function normalizePackageName(value: string): string {
  const trimmed = value.trim();
  const scopedMatch = /^@([^/]+)\/(.+)$/.exec(trimmed);

  if (scopedMatch) {
    const scope = normalizePackageSegment(scopedMatch[1] ?? "");
    const name = normalizePackageSegment(scopedMatch[2] ?? "");

    if (!scope || !name) {
      throw new Error(`Invalid plugin package name: ${value}`);
    }

    return `@${scope}/${name}`;
  }

  const normalized = normalizePackageSegment(trimmed);

  if (!normalized) {
    throw new Error(`Invalid plugin package name: ${value}`);
  }

  return normalized;
}

function normalizePackageSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .replaceAll(/-{2,}/g, "-");
}

function validateId(label: string, value: string): void {
  if (!idPattern.test(value)) {
    throw new Error(
      `${label} must use lowercase dot-separated segments, for example dev.example.my-plugin.`,
    );
  }
}

async function assertWritableTarget(targetDir: string, force: boolean): Promise<void> {
  let targetStat;

  try {
    targetStat = await stat(targetDir);
  } catch (error) {
    if (isNotFoundError(error)) {
      await mkdir(targetDir, { recursive: true });
      return;
    }

    throw error;
  }

  if (!targetStat.isDirectory()) {
    throw new Error(`Target path already exists and is not a directory: ${targetDir}`);
  }

  if (force) {
    return;
  }

  const entries = await readdir(targetDir);

  if (entries.length > 0) {
    throw new Error(`Target directory is not empty: ${targetDir}`);
  }
}

async function renderTemplateDirectory(
  templateDir: string,
  targetDir: string,
  rootDir: string,
  data: CreatePluginTemplateData,
): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(templateDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(templateDir, entry.name);
    const targetPath = path.join(targetDir, getTargetFileName(entry.name));

    if (entry.isDirectory()) {
      await mkdir(targetPath, { recursive: true });
      files.push(...(await renderTemplateDirectory(sourcePath, targetPath, rootDir, data)));
      continue;
    }

    if (entry.isFile() && shouldRenderTextTemplate(entry.name)) {
      const template = await readFile(sourcePath, "utf8");
      const output = await renderTextTemplate(template, data);

      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, output, "utf8");
      files.push(path.relative(rootDir, targetPath));
      continue;
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { force: true });
    files.push(path.relative(rootDir, targetPath));
  }

  return files;
}

async function renderTextTemplate(
  template: string,
  data: CreatePluginTemplateData,
): Promise<string> {
  const eta = (await import("eta")) as unknown as EtaModule;

  if (eta.Eta) {
    return new eta.Eta({ autoEscape: false }).renderString(template, data);
  }

  if (eta.renderString) {
    return eta.renderString(template, data);
  }

  throw new Error("The installed eta package does not expose a supported render API.");
}

function shouldRenderTextTemplate(fileName: string): boolean {
  return fileName.endsWith(".eta") || /\.(json|ts|tsx|js|mjs|md|txt|yml|yaml)$/.test(fileName);
}

function getTargetFileName(fileName: string): string {
  return fileName.endsWith(".eta") ? fileName.slice(0, -".eta".length) : fileName;
}

function getTemplateDir(template: string): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(currentDir, "..", "templates", template),
    path.resolve(currentDir, "..", "..", "templates", template),
  ];
  const templateDir = candidates.find((candidate) => existsSync(candidate));

  if (!templateDir) {
    throw new Error(
      `Template directory was not found for ${template}. Checked: ${candidates.join(", ")}`,
    );
  }

  return templateDir;
}

function titleCase(value: string): string {
  const words = value.split(/[-._\s]+/).filter(Boolean);

  if (words.length === 0) {
    return "Tooldeck Plugin";
  }

  return words.map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`).join(" ");
}

function camelCase(value: string): string {
  const words = value.split(/[^a-zA-Z0-9]+/).filter(Boolean);

  if (words.length === 0) {
    return "command";
  }

  return words
    .map((word, index) => {
      const lower = word.toLowerCase();

      if (index === 0) {
        return lower;
      }

      return `${lower[0]?.toUpperCase() ?? ""}${lower.slice(1)}`;
    })
    .join("");
}

function pascalCase(value: string): string {
  const result = camelCase(value);

  return `${result[0]?.toUpperCase() ?? "Command"}${result.slice(1)}`;
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
