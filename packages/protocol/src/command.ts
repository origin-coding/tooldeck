import type { LocalizedString } from "./i18n";
import type { JsonObject, JsonValue } from "./json";
import type { TooldeckInputJsonSchema, TooldeckJsonSchema } from "./schema";

export type CommandUiLayoutV1 = "stacked" | "split";

export interface CommandUiV1 {
  layout?: CommandUiLayoutV1;
}

export interface CommandDefinitionV1 {
  id: string;
  title: LocalizedString;
  description?: LocalizedString;
  "x-ui"?: CommandUiV1;
  inputSchema?: TooldeckInputJsonSchema;
  outputSchema?: TooldeckJsonSchema;
}

export type CommandStatusV1 = "success" | "error";

export interface TextContentBlockV1 {
  type: "text";
  text: string;
}

export interface CodeContentBlockV1 {
  type: "code";
  text: string;
  language?: string;
}

export interface JsonContentBlockV1 {
  type: "json";
  value: JsonValue;
}

export type PropertyValueV1 = string | number | boolean | null;

export interface PropertyItemV1 {
  label: LocalizedString;
  value: PropertyValueV1;
  note?: LocalizedString;
}

export interface PropertiesContentBlockV1 {
  type: "properties";
  items: PropertyItemV1[];
}

export type ContentBlockV1 =
  | TextContentBlockV1
  | CodeContentBlockV1
  | JsonContentBlockV1
  | PropertiesContentBlockV1;

export interface CommandErrorV1 {
  message: string;
  code?: string;
  metadata?: JsonObject;
}

export interface CommandResultV1 {
  status: CommandStatusV1;
  blocks: ContentBlockV1[];
  error?: CommandErrorV1;
}

export type CommandDefinition = CommandDefinitionV1;
export type CommandUi = CommandUiV1;
export type CommandUiLayout = CommandUiLayoutV1;
export type CommandStatus = CommandStatusV1;
export type ContentBlock = ContentBlockV1;
export type CodeContentBlock = CodeContentBlockV1;
export type JsonContentBlock = JsonContentBlockV1;
export type PropertiesContentBlock = PropertiesContentBlockV1;
export type PropertyItem = PropertyItemV1;
export type PropertyValue = PropertyValueV1;
export type TextContentBlock = TextContentBlockV1;
export type CommandError = CommandErrorV1;
export type CommandResult = CommandResultV1;
