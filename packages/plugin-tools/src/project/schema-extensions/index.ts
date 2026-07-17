import type { PluginManifest } from "@tooldeck/protocol";

import type { PluginProjectDiagnostic } from "../types";
import { isRecord } from "../utils";
import { checkSchemaI18n } from "./schema-i18n";
import { checkInputSchemaSubset } from "./schema-subset";
import {
  checkInputFieldUi,
  checkNestedInputSchemaUi,
  checkOutputSchemaUi,
  checkRootInputSchemaUi,
} from "./schema-ui";
import { walkSchemaNodes } from "./schema-walk";

export function checkSupportedSchemaExtensions(
  manifest: PluginManifest,
  manifestPath: string,
  diagnostics: PluginProjectDiagnostic[],
): void {
  manifest.contributes?.commands?.forEach((command, commandIndex) => {
    const inputSchema = command.inputSchema;

    if (isRecord(inputSchema)) {
      walkSchemaNodes(inputSchema, (node) => {
        checkInputSchemaSubset(
          node.schema,
          manifestPath,
          commandIndex,
          node.schemaPath,
          diagnostics,
        );
        checkSchemaI18n(node.schema, manifestPath, commandIndex, node.schemaPath, diagnostics);

        if (node.schemaPath === "$") {
          checkRootInputSchemaUi(inputSchema, manifestPath, commandIndex, diagnostics);
        } else if (node.parentKeyword === "properties" && node.parentSchemaPath === "$") {
          checkInputFieldUi(node.schema, manifestPath, commandIndex, node.key ?? "", diagnostics);
        } else {
          checkNestedInputSchemaUi(
            node.schema,
            manifestPath,
            commandIndex,
            node.schemaPath,
            diagnostics,
          );
        }
      });
    }

    const outputSchema = command.outputSchema;

    if (isRecord(outputSchema)) {
      walkSchemaNodes(outputSchema, (node) => {
        checkOutputSchemaUi(
          command.id,
          node.schema,
          manifestPath,
          commandIndex,
          node.schemaPath,
          diagnostics,
        );
      });
    }
  });
}
