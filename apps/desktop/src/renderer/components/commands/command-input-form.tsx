import { getInputFields } from "@/renderer/app/command-input";
import { EmptyState } from "@/renderer/components/common/empty-state";
import { Badge } from "@/renderer/components/ui/badge";
import { Input } from "@/renderer/components/ui/input";
import { Label } from "@/renderer/components/ui/label";
import { Textarea } from "@/renderer/components/ui/textarea";
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
    return (
      <div className="border-border bg-muted/30 text-muted-foreground flex min-h-48 items-center justify-center rounded-md border border-dashed text-sm">
        No input required
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {fields.map((field) => (
        <div key={field.key} className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`command-input-${field.key}`}>{field.title}</Label>
            {field.required ? <Badge variant="outline">Required</Badge> : null}
          </div>
          {field.kind === "textarea" ? (
            <Textarea
              id={`command-input-${field.key}`}
              spellCheck={false}
              value={input[field.key] ?? ""}
              className="min-h-72 resize-none font-mono text-sm"
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          ) : (
            <Input
              id={`command-input-${field.key}`}
              type={field.kind === "number" ? "number" : "text"}
              min={field.minimum}
              max={field.maximum}
              value={input[field.key] ?? ""}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          )}
          {field.description ? (
            <p className="text-muted-foreground text-xs">{field.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
