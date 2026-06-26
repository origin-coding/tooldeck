import type {
  CodeContentBlock,
  CommandResult,
  ContentBlock,
  JsonContentBlock,
  JsonValue,
  PropertiesContentBlock,
  PropertyItem,
  TextContentBlock,
} from "@tooldeck/protocol";

export function textBlock(text: string): TextContentBlock {
  return {
    type: "text",
    text,
  };
}

export function codeBlock(text: string, language?: string): CodeContentBlock {
  return {
    type: "code",
    text,
    ...(language === undefined ? {} : { language }),
  };
}

export function jsonBlock(value: JsonValue): JsonContentBlock {
  return {
    type: "json",
    value,
  };
}

export function propertiesBlock(items: PropertyItem[]): PropertiesContentBlock {
  return {
    type: "properties",
    items,
  };
}

export function ok(blocks: ContentBlock[]): CommandResult {
  return {
    status: "success",
    blocks,
  };
}

export function okText(text: string): CommandResult {
  return ok([textBlock(text)]);
}

export function fail(code: string, message: string, blocks: ContentBlock[] = []): CommandResult {
  return {
    status: "error",
    blocks,
    error: {
      code,
      message,
    },
  };
}

export function failText(code: string, message: string, text?: string): CommandResult {
  return fail(code, message, text === undefined ? [] : [textBlock(text)]);
}
