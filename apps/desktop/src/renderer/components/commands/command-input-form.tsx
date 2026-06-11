import { Form, Input, InputNumber, Tag } from "antd";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const fields = getInputFields(command);

  if (!command) {
    return <EmptyState text={t("command.form.noCommandSelected")} />;
  }

  if (fields.length === 0) {
    return <EmptyState text={t("command.form.noInputRequired")} />;
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
          {field.kind === "textarea" ? (
            <Input.TextArea
              id={`command-input-${field.key}`}
              placeholder={field.placeholder}
              rows={field.rows ?? 12}
              spellCheck={false}
              value={input[field.key] ?? ""}
              className="!resize-none font-mono"
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          ) : field.kind === "number" ? (
            <InputNumber
              id={`command-input-${field.key}`}
              max={field.maximum}
              min={field.minimum}
              placeholder={field.placeholder}
              value={input[field.key] === "" ? null : Number(input[field.key])}
              onChange={(value) => onChange(field.key, value === null ? "" : String(value))}
            />
          ) : (
            <Input
              id={`command-input-${field.key}`}
              placeholder={field.placeholder}
              value={input[field.key] ?? ""}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          )}
        </Form.Item>
      ))}
    </Form>
  );
}
