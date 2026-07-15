export const TOOLDECK_PLUGIN_PACKAGE_EXTENSION = ".tdplugin";

export type PluginPackageDropValidation =
  | { valid: true; file: File }
  | { valid: false; reason: "empty" | "multiple" | "invalid-extension" };

export function validatePluginPackageDrop(
  files: FileList | readonly File[],
): PluginPackageDropValidation {
  const droppedFiles = Array.from(files);

  if (droppedFiles.length === 0) {
    return { valid: false, reason: "empty" };
  }

  if (droppedFiles.length !== 1) {
    return { valid: false, reason: "multiple" };
  }

  const file = droppedFiles[0]!;

  if (!file.name.endsWith(TOOLDECK_PLUGIN_PACKAGE_EXTENSION)) {
    return { valid: false, reason: "invalid-extension" };
  }

  return { valid: true, file };
}
