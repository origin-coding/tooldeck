import type {
  CheckPluginProjectResult,
  InspectPluginProjectResult,
  PluginProjectDiagnostic,
  TooldeckPackageInspection,
} from "./types";

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
