import type {
  CommandResult,
  LocalizedString,
  PropertiesContentBlock,
  PropertyValue,
} from "@tooldeck/protocol";
import { consola } from "consola";

import type { ListedCliCommand } from "./command-runtime";
import { formatCommandList } from "./output";
import type { CliOutputFormat } from "./preferences";

export type ListCliResource = "commands" | "plugins" | "preferences";
export function printCommandResult(
  result: CommandResult,
  outputFormat: CliOutputFormat = "text",
): void {
  if (outputFormat === "json") {
    consola.log(JSON.stringify(result, null, 2));
  } else {
    for (const block of result.blocks) {
      if (block.type === "text" || block.type === "code") {
        consola.log(block.text);
      } else if (block.type === "json") {
        consola.log(JSON.stringify(block.value, null, 2));
      } else if (block.type === "properties") {
        consola.log(formatPropertiesBlock(block));
      }
    }

    if (result.status === "error") {
      consola.error(result.error?.message ?? "Command failed.");
    }
  }

  if (result.status === "error") {
    process.exitCode = 1;
  }
}

export function printCommandList(
  commands: ListedCliCommand[],
  outputFormat: CliOutputFormat = "text",
): void {
  if (outputFormat === "json") {
    consola.log(JSON.stringify(commands, null, 2));
    return;
  }

  consola.log(formatCommandList(commands));
}

export function printUnsupportedListResource(resource: string): void {
  consola.error(
    `Unsupported list resource: ${resource}\nSupported list resources: commands, plugins, preferences`,
  );
}

export function normalizeListCliResource(resource?: string): ListCliResource | undefined {
  if (resource === undefined || resource === "command" || resource === "commands") {
    return "commands";
  }

  if (resource === "plugin" || resource === "plugins") {
    return "plugins";
  }

  if (resource === "preference" || resource === "preferences") {
    return "preferences";
  }

  return undefined;
}

function resolveLocalizedString(value: LocalizedString): string {
  if (typeof value === "string") {
    return value;
  }

  return value.default;
}

function formatPropertiesBlock(block: PropertiesContentBlock): string {
  return block.items
    .map((item) => {
      const note = item.note ? ` (${resolveLocalizedString(item.note)})` : "";

      return `${resolveLocalizedString(item.label)}: ${formatPropertyValue(item.value)}${note}`;
    })
    .join("\n");
}

function formatPropertyValue(value: PropertyValue): string {
  return value === null ? "null" : String(value);
}
