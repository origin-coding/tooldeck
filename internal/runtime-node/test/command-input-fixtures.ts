import type { JsonSchemaIssueCode } from "@tooldeck/json-schema";
import type { JsonObject, TooldeckInputJsonSchema } from "@tooldeck/protocol";
import { expect } from "vitest";

import { ManifestIndex, type CommandInputCoercion } from "@/index";

export function normalizeCommandInput(options: {
  input?: Record<string, unknown>;
  inputSchema?: TooldeckInputJsonSchema;
  commandId?: string;
  coercion?: CommandInputCoercion;
}): JsonObject {
  const commandId = options.commandId ?? "test.command";
  const manifestIndex = new ManifestIndex();

  manifestIndex.addPluginManifest({
    manifest: {
      schemaVersion: "1.0",
      id: "dev.tooldeck.command-input-test",
      name: "Command Input Test",
      version: "0.0.0",
      runtime: {
        kind: "node",
        entry: "./dist/index.js",
      },
      contributes: {
        commands: [
          {
            id: commandId,
            title: "Command Input Test",
            ...(options.inputSchema ? { inputSchema: options.inputSchema } : {}),
          },
        ],
      },
    },
    manifestPath: "plugins/command-input-test/manifest.json",
    entryPath: "plugins/command-input-test/dist/index.js",
  });

  return manifestIndex.normalizeCommandInput({
    commandId,
    input: options.input ?? {},
    coercion: options.coercion ?? "none",
  });
}

export function expectCommandInputIssues(
  run: () => unknown,
  issues: Array<{ code: JsonSchemaIssueCode; propertyPath: string }>,
): void {
  let thrown: unknown;

  try {
    run();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toMatchObject({
    code: "ERR_INVALID_ARGUMENT",
    details: {
      issue: "invalid_command_input",
      schemaError: {
        kind: "validation",
        code: "value_does_not_match_schema",
        issues: expect.arrayContaining(issues.map((issue) => expect.objectContaining(issue))),
      },
    },
  });
}
