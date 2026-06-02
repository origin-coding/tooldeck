import { definePlugin } from "@tooldeck/sdk";

interface JsonFormatInput {
  text: string;
  indent?: number;
}

interface PluginCommandInputs {
  "json.format": JsonFormatInput;
}

export default definePlugin<PluginCommandInputs>({
  activate(ctx) {
    ctx.subscriptions.push(
      ctx.commands.register("json.format", async (input) => {
        if (typeof input.text !== "string") {
          return {
            status: "error",
            blocks: [
              {
                type: "text",
                text: "json.format requires a text string.",
              },
            ],
            error: {
              code: "ERR_INVALID_INPUT",
              message: "json.format requires a text string.",
            },
          };
        }

        try {
          const value = JSON.parse(input.text);
          const indent = normalizeIndent(input.indent);

          return {
            status: "success",
            blocks: [
              {
                type: "text",
                text: JSON.stringify(value, null, indent),
              },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          return {
            status: "error",
            blocks: [
              {
                type: "text",
                text: `Invalid JSON: ${message}`,
              },
            ],
            error: {
              code: "ERR_INVALID_JSON",
              message,
            },
          };
        }
      }),
    );
  },
});

function normalizeIndent(value: number | undefined): number {
  if (value === undefined) {
    return 2;
  }

  if (!Number.isInteger(value) || value < 0 || value > 8) {
    return 2;
  }

  return value;
}
