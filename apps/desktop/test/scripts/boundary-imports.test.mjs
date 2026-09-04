import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { checkBoundaryImports } from "../../scripts/boundary-imports.mjs";

const desktopRoot = fileURLToPath(new URL("../../", import.meta.url));

for (const [file, source] of [
  ["shared/api/example.ts", 'import type { Value } from "@tooldeck/application-node";'],
  ["shared/api/example.ts", 'export type { Value } from "@tooldeck/state-machine";'],
  ["shared/api/example.ts", 'type Value = import("effect/Schema").Schema;'],
  ["shared/api/example.ts", 'import "electron";'],
  ["shared/api/example.ts", 'export * from "../transport/ipc";'],
  ["shared/api/example.ts", 'export * from "@/main/desktop-contract/errors";'],
  ["shared/transport/example.ts", 'export * from "@tooldeck/runtime-node";'],
  ["renderer/example.ts", 'export * from "@/shared/transport/ipc";'],
  ["renderer/example.ts", 'const ipc = import("../shared/transport/ipc");'],
  ["renderer/example.ts", 'import { api } from "../preload/api";'],
  ["renderer/example.ts", 'const ipc = require("electron");'],
  ["renderer/example.ts", 'const channel = "tooldeck:run-command";'],
  ["renderer/example.ts", "const load = (name: string) => import(name);"],
  ["preload/example.ts", 'export * from "../main/application";'],
  ["preload/example.ts", 'import { Schema } from "effect";'],
]) {
  test(`rejects ${file}: ${source}`, () => {
    assert.notEqual(
      checkBoundaryImports(path.join(desktopRoot, "src", file), source, desktopRoot).length,
      0,
    );
  });
}

for (const [file, source] of [
  ["shared/api/example.ts", 'import type { JsonObject } from "@tooldeck/protocol";'],
  ["shared/api/example.ts", 'export * from "./errors";'],
  ["shared/transport/example.ts", 'import type { DesktopApiError } from "../api";'],
  ["renderer/example.ts", 'import { isDesktopApiError } from "@/shared/api";'],
  ["renderer/example.ts", 'export * from "../shared/api/errors";'],
  ["renderer/example.ts", 'const Page = import("./pages/plugins");'],
  ["preload/example.ts", 'import { ipcRenderer } from "electron";'],
  ["preload/example.ts", 'import { desktopIpcChannels } from "@/shared/transport/ipc";'],
]) {
  test(`allows ${file}: ${source}`, () => {
    assert.deepEqual(
      checkBoundaryImports(path.join(desktopRoot, "src", file), source, desktopRoot),
      [],
    );
  });
}
