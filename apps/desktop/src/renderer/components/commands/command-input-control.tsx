import type { JsonPrimitive } from "@tooldeck/shared";
import { Checkbox, Input, InputNumber, Radio, Select } from "antd";

import type {
  CheckboxGroupInputField,
  CheckboxInputField,
  InputField,
  InputFieldOption,
  MultiSelectInputField,
  NumberInputField,
  RadioInputField,
  SelectInputField,
  TextareaInputField,
  TextInputField,
} from "@/renderer/app/command-input";

type CommandInputControlProps =
  | {
      kind: "text";
      field: TextInputField;
      value: string | undefined;
      onChange(value: string): void;
    }
  | {
      kind: "textarea";
      field: TextareaInputField;
      value: string | undefined;
      onChange(value: string): void;
    }
  | {
      kind: "number";
      field: NumberInputField;
      value: number | "" | undefined;
      onChange(value: number | ""): void;
    }
  | {
      kind: "checkbox";
      field: CheckboxInputField;
      value: boolean | undefined;
      onChange(value: boolean): void;
    }
  | {
      kind: "radio" | "select";
      field: RadioInputField | SelectInputField;
      value: JsonPrimitive | "" | undefined;
      onChange(value: JsonPrimitive | ""): void;
    }
  | {
      kind: "checkboxGroup" | "multiSelect";
      field: CheckboxGroupInputField | MultiSelectInputField;
      value: JsonPrimitive[] | undefined;
      onChange(value: JsonPrimitive[]): void;
    };

export function CommandInputControl(props: CommandInputControlProps) {
  switch (props.kind) {
    case "textarea": {
      const { field, value, onChange } = props;

      return (
        <Input.TextArea
          id={getInputId(field)}
          placeholder={field.placeholder}
          rows={field.rows ?? 12}
          spellCheck={false}
          value={value ?? ""}
          className="resize-none! font-mono"
          onChange={(event) => onChange(event.target.value)}
        />
      );
    }

    case "number": {
      const { field, value, onChange } = props;

      return (
        <InputNumber
          id={getInputId(field)}
          max={field.maximum}
          min={field.minimum}
          placeholder={field.placeholder}
          value={typeof value === "number" ? value : null}
          onChange={(nextValue) => onChange(nextValue === null ? "" : nextValue)}
        />
      );
    }

    case "checkbox": {
      const { field, value, onChange } = props;

      return (
        <Checkbox
          id={getInputId(field)}
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
      );
    }

    case "radio": {
      const { field, value, onChange } = props;

      return (
        <Radio.Group
          id={getInputId(field)}
          options={getEncodedOptions(field.options)}
          value={encodeControlValue(value)}
          onChange={(event) => onChange(decodeOptionValue(event.target.value, field.options) ?? "")}
        />
      );
    }

    case "select": {
      const { field, value, onChange } = props;

      return (
        <Select
          id={getInputId(field)}
          className="w-full"
          options={getEncodedOptions(field.options)}
          placeholder={field.placeholder}
          value={value === "" ? undefined : encodeControlValue(value)}
          onChange={(nextValue) => onChange(decodeOptionValue(nextValue, field.options) ?? "")}
        />
      );
    }

    case "checkboxGroup": {
      const { field, value, onChange } = props;

      return (
        <Checkbox.Group
          className="flex flex-col gap-2"
          options={getEncodedOptions(field.options)}
          value={encodeArrayValue(value)}
          onChange={(nextValue) => onChange(decodeArrayValue(nextValue.map(String), field.options))}
        />
      );
    }

    case "multiSelect": {
      const { field, value, onChange } = props;

      return (
        <Select
          id={getInputId(field)}
          className="w-full"
          mode="multiple"
          options={getEncodedOptions(field.options)}
          placeholder={field.placeholder}
          value={encodeArrayValue(value)}
          onChange={(nextValue) => onChange(decodeArrayValue(nextValue, field.options))}
        />
      );
    }

    case "text": {
      const { field, value, onChange } = props;

      return (
        <Input
          id={getInputId(field)}
          placeholder={field.placeholder}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    }
  }
}

function getInputId(field: InputField): string {
  return `command-input-${field.key}`;
}

function getEncodedOptions(options: InputFieldOption[] | undefined): Array<{
  label: string;
  value: string;
}> {
  return (options ?? []).map((option) => ({
    label: option.label,
    value: encodeOptionValue(option.value),
  }));
}

function encodeArrayValue(value: JsonPrimitive[] | undefined): string[] {
  return Array.isArray(value) ? value.map(encodeOptionValue) : [];
}

function decodeArrayValue(
  values: string[],
  options: InputFieldOption[] | undefined,
): JsonPrimitive[] {
  return values
    .map((value) => decodeOptionValue(value, options))
    .filter((value): value is JsonPrimitive => value !== undefined && !Array.isArray(value));
}

function encodeOptionValue(value: JsonPrimitive): string {
  return JSON.stringify(value);
}

function encodeControlValue(value: JsonPrimitive | "" | undefined): string | undefined {
  return isJsonPrimitive(value) ? encodeOptionValue(value) : undefined;
}

function decodeOptionValue(
  value: string,
  options: InputFieldOption[] | undefined,
): JsonPrimitive | undefined {
  return options?.find((option) => encodeOptionValue(option.value) === value)?.value;
}

function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}
