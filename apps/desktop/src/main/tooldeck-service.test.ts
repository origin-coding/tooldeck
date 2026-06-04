import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { TooldeckDesktopService } from "./tooldeck-service";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("TooldeckDesktopService", () => {
  it("lists commands, runs json.format, and records desktop history", async () => {
    const service = new TooldeckDesktopService({
      pluginsRoot: path.resolve("../..", "plugins"),
      storagePath: createDatabasePath(),
    });

    await service.start();

    try {
      const commands = service.listCommands();

      expect(commands).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "json.format",
            pluginId: "dev.tooldeck.json-tools",
            title: "Format JSON",
          }),
        ]),
      );

      await expect(
        service.runCommand({
          commandId: "json.format",
          input: {
            text: '{"a":1}',
            indent: 2,
          },
        }),
      ).resolves.toEqual({
        status: "success",
        blocks: [
          {
            type: "text",
            text: '{\n  "a": 1\n}',
          },
        ],
      });

      expect(service.listCommandRuns()).toEqual([
        expect.objectContaining({
          commandId: "json.format",
          pluginId: "dev.tooldeck.json-tools",
          source: "desktop",
          status: "success",
          input: {
            text: '{"a":1}',
            indent: 2,
          },
          output: {
            status: "success",
            blocks: [
              {
                type: "text",
                text: '{\n  "a": 1\n}',
              },
            ],
          },
          durationMs: expect.any(Number),
          createdAt: expect.any(Number),
        }),
      ]);
    } finally {
      await service.dispose();
    }
  });
});

function createDatabasePath(): string {
  return path.join(createTempDir(), "tooldeck.sqlite");
}

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tooldeck-desktop-"));

  tempDirs.push(dir);

  return dir;
}
