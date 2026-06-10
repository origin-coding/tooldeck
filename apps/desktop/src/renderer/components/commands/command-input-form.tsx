import { Form, Input, InputNumber, Tag } from "antd";

import { getInputFields } from "@/renderer/app/command-input";
import { EmptyState } from "@/renderer/components/common/empty-state";
import type { DesktopCommand } from "@/shared/desktop-api";

export function CommandInputForm({
  command,
  input,
  onChange,
}: {
  command?: DesktopCommand;
  input: Record<string, string>;
  onChange(key: string, value: string): void;
}) {
  const fields = getInputFields(command);

  if (!command) {
    return <EmptyState text="No command selected" />;
  }

  if (fields.length === 0) {
    return <EmptyState text="No input required" />;
  }

  return (
    <Form layout="vertical">
      {fields.map((field) => (
        <Form.Item
          key={field.key}
          extra={field.description}
          label={
            <span className="field-label">
              {field.title}
              {field.required ? <Tag>Required</Tag> : null}
            </span>
          }
          required={field.required}
        >
          {field.kind === "textarea" ? (
            <Input.TextArea
              id={`command-input-${field.key}`}
              spellCheck={false}
              value={input[field.key] ?? ""}
              className="code-input"
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          ) : field.kind === "number" ? (
            <InputNumber
              id={`command-input-${field.key}`}
              max={field.maximum}
              min={field.minimum}
              value={input[field.key] === "" ? null : Number(input[field.key])}
              onChange={(value) => onChange(field.key, value === null ? "" : String(value))}
            />
          ) : (
            <Input
              id={`command-input-${field.key}`}
              value={input[field.key] ?? ""}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          )}
        </Form.Item>
      ))}
    </Form>
  );
}
