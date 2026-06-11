import type { JsonPrimitive } from "@tooldeck/shared";
import { Form, Tag } from "antd";
import { useTranslation } from "react-i18next";

import { getInputFields } from "@/renderer/app/command-input";
import type {
  CommandInputState,
  CommandInputValue,
  InputField,
} from "@/renderer/app/command-input";
import { CommandInputControl } from "@/renderer/components/commands/command-input-control";
import { EmptyState } from "@/renderer/components/common/empty-state";
import type { DesktopCommand } from "@/shared/desktop-api";

export function CommandInputForm({
  command,
  input,
  onChange,
}: {
  command?: DesktopCommand;
  input: CommandInputState;
  onChange(key: string, value: CommandInputValue): void;
}) {
  const { t } = useTranslation();
  const fields = getInputFields(command);

  if (!command) {
    return (
      <EmptyState
        className="flex min-h-40 flex-col items-center justify-center"
        text={t("command.form.noCommandSelected")}
      />
    );
  }

  if (fields.length === 0) {
    return (
      <EmptyState
        className="flex min-h-40 flex-col items-center justify-center"
        text={t("command.form.noInputRequired")}
      />
    );
  }

  return (
    <Form layout="vertical">
      {fields.map((field) => (
        <Form.Item
          key={field.key}
          extra={field.description}
          label={
            <span className="flex items-center gap-2">
              {field.title}
              {field.required ? <Tag>{t("command.form.required")}</Tag> : null}
            </span>
          }
          required={field.required}
        >
          {renderInputControl(field, input[field.key], (value) => onChange(field.key, value))}
        </Form.Item>
      ))}
    </Form>
  );
}

function renderInputControl(
  field: InputField,
  value: CommandInputValue | undefined,
  onChange: (value: CommandInputValue) => void,
) {
  if (field.kind === "checkbox") {
    return (
      <CommandInputControl
        kind={field.kind}
        field={field}
        value={value === true}
        onChange={(nextValue: boolean) => onChange(nextValue)}
      />
    );
  }

  if (field.kind === "checkboxGroup") {
    return (
      <CommandInputControl
        kind={field.kind}
        field={field}
        value={Array.isArray(value) ? value : []}
        onChange={(nextValue: JsonPrimitive[]) => onChange(nextValue)}
      />
    );
  }

  if (field.kind === "multiSelect") {
    return (
      <CommandInputControl
        kind={field.kind}
        field={field}
        value={Array.isArray(value) ? value : []}
        onChange={(nextValue: JsonPrimitive[]) => onChange(nextValue)}
      />
    );
  }

  if (field.kind === "number") {
    return (
      <CommandInputControl
        kind={field.kind}
        field={field}
        value={typeof value === "number" ? value : ""}
        onChange={(nextValue: number | "") => onChange(nextValue)}
      />
    );
  }

  if (field.kind === "radio") {
    return (
      <CommandInputControl
        kind={field.kind}
        field={field}
        value={isJsonPrimitive(value) ? value : ""}
        onChange={(nextValue: JsonPrimitive | "") => onChange(nextValue)}
      />
    );
  }

  if (field.kind === "select") {
    return (
      <CommandInputControl
        kind={field.kind}
        field={field}
        value={isJsonPrimitive(value) ? value : ""}
        onChange={(nextValue: JsonPrimitive | "") => onChange(nextValue)}
      />
    );
  }

  if (field.kind === "textarea") {
    return (
      <CommandInputControl
        kind={field.kind}
        field={field}
        value={typeof value === "string" ? value : ""}
        onChange={(nextValue: string) => onChange(nextValue)}
      />
    );
  }

  return (
    <CommandInputControl
      kind={field.kind}
      field={field}
      value={typeof value === "string" ? value : ""}
      onChange={(nextValue: string) => onChange(nextValue)}
    />
  );
}

function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}
