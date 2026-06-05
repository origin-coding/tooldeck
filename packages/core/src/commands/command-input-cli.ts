type RawCliOptionValue = string | boolean;

export function parseRawCliInputOptions(options: {
  rawArgs: string[];
  commandId: string;
  ignoredOptions: string[];
}): Record<string, RawCliOptionValue> {
  const input: Record<string, RawCliOptionValue> = {};
  const ignoredOptions = new Set(options.ignoredOptions);
  let commandIdConsumed = false;

  for (let index = 0; index < options.rawArgs.length; index += 1) {
    const token = options.rawArgs[index];

    if (token === "--") {
      break;
    }

    if (!token.startsWith("--")) {
      if (!commandIdConsumed && token === options.commandId) {
        commandIdConsumed = true;
      }

      continue;
    }

    const optionToken = token.slice(2);
    const equalsIndex = optionToken.indexOf("=");
    const optionName = equalsIndex >= 0 ? optionToken.slice(0, equalsIndex) : optionToken;

    if (ignoredOptions.has(optionName)) {
      if (equalsIndex < 0) {
        index += 1;
      }

      continue;
    }

    if (optionName.startsWith("no-")) {
      input[toCamelCase(optionName.slice(3))] = false;
      continue;
    }

    if (equalsIndex >= 0) {
      input[toCamelCase(optionName)] = optionToken.slice(equalsIndex + 1);
      continue;
    }

    const nextToken = options.rawArgs[index + 1];

    if (nextToken !== undefined && !nextToken.startsWith("--")) {
      input[toCamelCase(optionName)] = nextToken;
      index += 1;
    } else {
      input[toCamelCase(optionName)] = true;
    }
  }

  return input;
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase());
}
