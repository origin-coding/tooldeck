import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { zipSync } from "fflate";
import { afterEach } from "vitest";

import { FflateZipAdapter, packTooldeckPlugin } from "../src";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

export async function createPackageProject(): Promise<string> {
  const projectDir = createTempDir();

  await mkdir(path.join(projectDir, "dist"), { recursive: true });
  await mkdir(path.join(projectDir, "locales"), { recursive: true });
  await mkdir(path.join(projectDir, "assets"), { recursive: true });
  await writeFile(
    path.join(projectDir, "manifest.json"),
    JSON.stringify({
      schemaVersion: "1.0",
      id: "dev.tooldeck.package-test",
      name: "Package Test",
      version: "0.1.0",
      runtime: {
        kind: "node",
        entry: "./dist/index.js",
      },
      defaultLocale: "en",
      locales: {
        en: "./locales/en.json",
      },
      contributes: {
        commands: [
          {
            id: "package.test",
            title: "Package Test",
          },
        ],
      },
    }),
    "utf8",
  );
  await writeFile(path.join(projectDir, "dist", "index.js"), "export default { activate() {} };\n");
  await writeFile(path.join(projectDir, "locales", "en.json"), JSON.stringify({}));
  await writeFile(path.join(projectDir, "assets", "icon.txt"), "icon");

  return projectDir;
}

export function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tooldeck-plugin-package-"));

  tempDirs.push(dir);

  return dir;
}

export function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export async function createReadablePackage(): Promise<string> {
  const projectDir = await createPackageProject();
  const packagePath = path.join(projectDir, "readable.tdplugin");

  await packTooldeckPlugin({
    projectDir,
    outputPath: packagePath,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
  });

  return packagePath;
}

export async function writeTooldeckPackage(
  packagePath: string,
  options: {
    files: Record<string, string | Uint8Array>;
  },
): Promise<void> {
  const adapter = new FflateZipAdapter();

  await adapter.writeArchive(
    packagePath,
    Object.entries(options.files).map(([entryPath, data]) => ({
      path: entryPath,
      data: typeof data === "string" ? encode(data) : data,
    })),
  );
}

export async function writeRawZip(
  packagePath: string,
  entries: Record<string, string | Uint8Array | [Uint8Array, { os?: number; attrs?: number }]>,
): Promise<void> {
  const zippable = Object.fromEntries(
    Object.entries(entries).map(([entryPath, data]) => [
      entryPath,
      typeof data === "string" ? encode(data) : data,
    ]),
  );

  await writeFile(packagePath, zipSync(zippable));
}

export function createManifest(
  options: {
    commandId?: string;
    runtimeEntry?: string;
    runtimeKind?: string;
  } = {},
): object {
  return {
    schemaVersion: "1.0",
    id: "dev.tooldeck.package-test",
    name: "Package Test",
    version: "0.1.0",
    runtime: {
      kind: options.runtimeKind ?? "node",
      entry: options.runtimeEntry ?? "./dist/index.js",
    },
    contributes: {
      commands: [
        {
          id: options.commandId ?? "package.test",
          title: "Package Test",
        },
      ],
    },
  };
}

export function patchFirstCentralDirectoryEntryFlag(
  data: Uint8Array,
  patch: (flag: number) => number,
): Uint8Array {
  const patched = new Uint8Array(data);
  const view = new DataView(patched.buffer, patched.byteOffset, patched.byteLength);
  const centralDirectoryOffset = findSignature(view, 0x02014b50);

  if (centralDirectoryOffset < 0) {
    throw new Error("Central directory not found.");
  }

  const flagOffset = centralDirectoryOffset + 8;
  view.setUint16(flagOffset, patch(view.getUint16(flagOffset, true)), true);

  return patched;
}

export function injectZip64Locator(data: Uint8Array): Uint8Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const eocdOffset = findSignature(view, 0x06054b50);

  if (eocdOffset < 0) {
    throw new Error("EOCD not found.");
  }

  const locator = new Uint8Array(20);
  new DataView(locator.buffer).setUint32(0, 0x07064b50, true);
  const patched = new Uint8Array(data.length + locator.length);

  patched.set(data.subarray(0, eocdOffset));
  patched.set(locator, eocdOffset);
  patched.set(data.subarray(eocdOffset), eocdOffset + locator.length);

  return patched;
}

export function findSignature(view: DataView, signature: number): number {
  for (let offset = 0; offset <= view.byteLength - 4; offset += 1) {
    if (view.getUint32(offset, true) === signature) {
      return offset;
    }
  }

  return -1;
}
