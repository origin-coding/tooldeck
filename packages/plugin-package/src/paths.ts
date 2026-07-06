import { packageError } from "./errors.js";

export function normalizePackagePath(input: string): string {
  const normalizedSlashes = input.replace(/\\/g, "/").trim();
  const withoutLeadingDot = normalizedSlashes.replace(/^\.\/+/, "");
  const collapsed = withoutLeadingDot.replace(/\/+/g, "/");

  return collapsed.endsWith("/") ? collapsed.slice(0, -1) : collapsed;
}

export function assertSafePackagePath(input: string, fieldPath?: string): string {
  const normalized = normalizePackagePath(input);

  if (normalized.length === 0) {
    throw packageError("INVALID_PACKAGE_PATH", "Package path must not be empty.", {
      entryPath: input,
      fieldPath,
      reason: "empty path",
    });
  }

  if (normalized.startsWith("/") || normalized.startsWith("//")) {
    throw packageError("INVALID_PACKAGE_PATH", "Package path must be relative.", {
      entryPath: input,
      fieldPath,
      reason: "absolute path",
    });
  }

  if (/^[A-Za-z]:\//.test(normalized)) {
    throw packageError("INVALID_PACKAGE_PATH", "Package path must not include a drive prefix.", {
      entryPath: input,
      fieldPath,
      reason: "drive-prefixed path",
    });
  }

  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "." || segment === ".." || segment.length === 0)) {
    throw packageError("INVALID_PACKAGE_PATH", "Package path must not contain traversal segments.", {
      entryPath: input,
      fieldPath,
      reason: "path traversal",
    });
  }

  if (isNodeModulesPath(normalized)) {
    throw packageError("NODE_MODULES_NOT_ALLOWED", "Package must not contain node_modules.", {
      entryPath: input,
      fieldPath,
      reason: "node_modules is not allowed",
    });
  }

  return normalized;
}

export function isNodeModulesPath(input: string): boolean {
  return normalizePackagePath(input)
    .split("/")
    .some((segment) => segment === "node_modules");
}

export function dedupeAndSortPackagePaths(paths: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(paths, (path) => assertSafePackagePath(path)))).sort(
    comparePackagePaths,
  );
}

export function comparePackagePaths(a: string, b: string): number {
  return a.localeCompare(b, "en", { sensitivity: "variant" });
}

export function packagePathStartsWith(path: string, directory: string): boolean {
  const normalizedPath = normalizePackagePath(path);
  const normalizedDirectory = normalizePackagePath(directory);

  return normalizedPath === normalizedDirectory || normalizedPath.startsWith(`${normalizedDirectory}/`);
}
