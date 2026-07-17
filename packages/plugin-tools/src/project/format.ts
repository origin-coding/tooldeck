import type {
  CheckPluginProjectResult,
  InspectPluginProjectResult,
  PluginProjectDiagnostic,
} from "./types";

export function formatPluginCheckResult(result: CheckPluginProjectResult): string {
  if (result.diagnostics.length === 0) {
    return "Plugin project check passed.";
  }

  return result.diagnostics.map(formatDiagnostic).join("\n");
}

export function formatPluginInspection(result: InspectPluginProjectResult): string {
  const lines = ["Tooldeck plugin inspection", ""];

  lines.push("Summary");
  lines.push(`  Status: ${formatInspectionStatus(result)}`);
  lines.push(
    `  Plugin: ${result.plugin ? `${result.plugin.id} (${result.plugin.version})` : "unavailable"}`,
  );
  lines.push(`  Name: ${result.plugin?.name ?? "unavailable"}`);
  lines.push(`  Manifest: ${result.manifestPath}`);
  lines.push(`  Package manager: ${result.packageManager ?? "not detected"}`);

  lines.push("", "Manifest");
  lines.push(`  Runtime entry: ${result.runtimeEntry ?? "unavailable"}`);
  lines.push(`  Generated commands: ${formatFileInspection(result.generated)}`);
  lines.push(`  Build output: ${formatFileInspection(result.buildOutput)}`);

  lines.push("", "Commands");
  if (result.commands.length === 0) {
    lines.push("  [missing] No commands declared.");
  } else {
    for (const commandId of result.commands) {
      const activationEvent = `onCommand:${commandId}`;
      const activationStatus = result.activationEvents.includes(activationEvent)
        ? activationEvent
        : "activation event unavailable";

      lines.push(`  [ok] ${commandId}`);
      lines.push(`       Activation: ${activationStatus}`);
    }
  }

  lines.push("", "Locales");
  if (result.locales.length === 0) {
    lines.push("  [missing] No locale files declared.");
  } else {
    for (const locale of result.locales) {
      lines.push(`  ${formatLocaleInspection(locale)}`);

      if (locale.missingKeys.length > 0) {
        lines.push(`       Missing keys: ${locale.missingKeys.toSorted().join(", ")}`);
      }
    }
  }

  lines.push("", "Packages");
  if (result.tooldeckPackages.length === 0) {
    lines.push("  [missing] No @tooldeck packages found in package.json.");
  } else {
    for (const packageInfo of result.tooldeckPackages) {
      lines.push(`  [ok] ${packageInfo.name}@${packageInfo.version} (${packageInfo.source})`);
    }
  }

  if (result.diagnostics.length > 0) {
    lines.push("", "Diagnostics");
    lines.push(...result.diagnostics.map(formatDiagnostic));
  }

  return lines.join("\n");
}

function formatDiagnostic(diagnostic: PluginProjectDiagnostic): string {
  const prefix = diagnostic.severity === "error" ? "error" : "warning";
  const lines = [`[${prefix}] ${diagnostic.code}`];

  if (diagnostic.path) {
    lines.push(`  File: ${diagnostic.path}`);
  }

  if (diagnostic.fieldPath) {
    lines.push(`  Field: ${diagnostic.fieldPath}`);
  }

  lines.push(`  Problem: ${diagnostic.message}`);

  if (diagnostic.suggestion) {
    lines.push(`  Fix: ${diagnostic.suggestion}`);
  }

  return lines.join("\n");
}

function formatInspectionStatus(result: InspectPluginProjectResult): string {
  if (result.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return "[error] Project has errors.";
  }

  if (result.diagnostics.some((diagnostic) => diagnostic.severity === "warning")) {
    return "[warning] Project has warnings.";
  }

  return "[ok] No project diagnostics.";
}

function formatFileInspection(file: InspectPluginProjectResult["generated"]): string {
  if (!file.exists) {
    return `[missing] ${file.path}`;
  }

  if (file.status === "stale") {
    return `[stale] ${file.path}`;
  }

  return `[ok] ${file.status} (${file.path})`;
}

function formatLocaleInspection(locale: InspectPluginProjectResult["locales"][number]): string {
  if (!locale.exists) {
    return `[missing] ${locale.locale} (${locale.path})`;
  }

  if (locale.missingKeys.length > 0) {
    return `[error] ${locale.locale}: missing ${locale.missingKeys.length} key(s) (${locale.path})`;
  }

  return `[ok] ${locale.locale} (${locale.path})`;
}
