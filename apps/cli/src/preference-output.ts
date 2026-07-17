import { consola } from "consola";

import { formatPreferenceList, formatPreferenceValue } from "./output";
import type { CliOutputFormat, ListedCliPreference } from "./preference-operations";

export function printPreferenceList(
  preferences: ListedCliPreference[],
  outputFormat: CliOutputFormat = "text",
): void {
  if (outputFormat === "json") {
    consola.log(JSON.stringify(preferences, null, 2));
    return;
  }

  consola.log(formatPreferenceList(preferences));
}

export function printPreferenceValue(value: unknown, outputFormat: CliOutputFormat = "text"): void {
  if (value === undefined) {
    consola.error("Preference not found.");
    process.exitCode = 1;
    return;
  }

  if (outputFormat === "json") {
    consola.log(JSON.stringify(value, null, 2));
    return;
  }

  consola.log(formatPreferenceValue(value));
}
