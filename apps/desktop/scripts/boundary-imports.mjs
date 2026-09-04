import { isBuiltin } from "node:module";
import path from "node:path";

import ts from "typescript";

// Check imports, re-exports, import types, and dynamic imports alike. Resolving
// local paths prevents a relative import from bypassing an alias restriction.
export function checkBoundaryImports(filePath, source, desktopRoot) {
  const relative = path.relative(desktopRoot, filePath).split(path.sep).join("/");
  const areas = {
    "src/renderer/": ["src/renderer", "src/shared/api"],
    "src/preload/": ["src/preload", "src/shared/api", "src/shared/transport"],
    "src/shared/api/": ["src/shared/api"],
    "src/shared/transport/": ["src/shared/api", "src/shared/transport"],
  };
  const area = Object.keys(areas).find((candidate) => relative.startsWith(candidate));

  if (!area) return [];

  const renderer = area === "src/renderer/";
  const shared = area.startsWith("src/shared/");
  const api = area === "src/shared/api/";
  const failures = [];
  const file = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);

  function report(node, message) {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
    failures.push(`${relative}:${line + 1}: ${message}`);
  }

  function inspectModule(node) {
    if (!node || !ts.isStringLiteralLike(node)) {
      report(node ?? file, "Boundary imports must use a literal module name.");
      return;
    }

    const name = node.text;
    if (name.startsWith(".") || name.startsWith("@/") || path.isAbsolute(name)) {
      const target = name.startsWith("@/")
        ? path.resolve(desktopRoot, "src", name.slice(2))
        : path.resolve(path.dirname(filePath), name);
      const allowed = areas[area].some((directory) => {
        const within = path.relative(path.resolve(desktopRoot, directory), target);
        return !path.isAbsolute(within) && within !== ".." && !within.startsWith(`..${path.sep}`);
      });
      if (!allowed) report(node, `Module is outside the ${area} boundary: ${name}`);
      return;
    }

    const forbidden =
      name.startsWith("#") ||
      isBuiltin(name) ||
      name === "effect" ||
      name.startsWith("effect/") ||
      (name.startsWith("@tooldeck/") && name !== "@tooldeck/protocol") ||
      ((renderer || shared) && (name === "electron" || name.startsWith("electron/"))) ||
      (shared && name !== "@tooldeck/protocol") ||
      (!renderer && !shared && name !== "electron" && name !== "@tooldeck/protocol");

    if (forbidden) report(node, `Forbidden boundary dependency: ${name}`);
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) inspectModule(node.moduleSpecifier);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      inspectModule(node.argument.literal);
    } else if (ts.isExternalModuleReference(node)) {
      inspectModule(node.expression);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      inspectModule(node.arguments[0]);
    }

    if (
      (renderer || api) &&
      ((ts.isStringLiteralLike(node) && node.text.startsWith("tooldeck:")) ||
        (ts.isIdentifier(node) &&
          ["ipcRenderer", "ipcMain", "desktopIpcChannels", "DesktopIpcResult"].includes(node.text)))
    ) {
      report(node, "Renderer-visible code must not reference raw IPC transport.");
    }

    ts.forEachChild(node, visit);
  }

  visit(file);
  return failures;
}
