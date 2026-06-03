import type { CommandHandler } from "@tooldeck/sdk";
import { definePlugin, failText, okText } from "@tooldeck/sdk";

import type { JsonFormatInput, PluginCommandInputs } from "./generated/commands";

export default definePlugin<PluginCommandInputs>((plugin) => {
  plugin.command("json.format", formatJson);
});

const formatJson: CommandHandler<JsonFormatInput> = async (input) => {
  if (typeof input.text !== "string") {
    const message = "json.format requires a text string.";

    return failText("ERR_INVALID_INPUT", message, message);
  }

  try {
    const value = JSON.parse(input.text);
    const indent = normalizeIndent(input.indent);

    return okText(JSON.stringify(value, null, indent));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return failText("ERR_INVALID_JSON", message, `Invalid JSON: ${message}`);
  }
};

function normalizeIndent(value: number | undefined): number {
  if (value === undefined) {
    return 2;
  }

  if (!Number.isInteger(value) || value < 0 || value > 8) {
    return 2;
  }

  return value;
}
