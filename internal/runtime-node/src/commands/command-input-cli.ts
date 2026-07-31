type RawCliScalarOptionValue = string | boolean;
type RawCliOptionValue = RawCliScalarOptionValue | RawCliScalarOptionValue[];

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
      setInputOption(input, optionName.slice(3), false);
      continue;
    }

    if (equalsIndex >= 0) {
      setInputOption(input, optionName, optionToken.slice(equalsIndex + 1));
      continue;
    }

    const nextToken = options.rawArgs[index + 1];

    if (nextToken !== undefined && !nextToken.startsWith("--")) {
      setInputOption(input, optionName, nextToken);
      index += 1;
    } else {
      setInputOption(input, optionName, true);
    }
  }

  return input;
}

function setInputOption(
  input: Record<string, RawCliOptionValue>,
  optionName: string,
  value: RawCliScalarOptionValue,
): void {
  const key = toCamelCase(optionName);
  const existingValue = input[key];

  if (existingValue === undefined) {
    input[key] = value;
    return;
  }

  if (Array.isArray(existingValue)) {
    existingValue.push(value);
    return;
  }

  input[key] = [existingValue, value];
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase());
}
