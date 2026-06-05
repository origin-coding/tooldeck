import type { CommandResult, ContentBlock } from "@tooldeck/protocol";

export function CommandOutput({ result, hasError }: { result?: CommandResult; hasError: boolean }) {
  if (!result) {
    return (
      <OutputState
        tone={hasError ? "error" : "idle"}
        title={hasError ? "Command failed" : "No output yet"}
        text={hasError ? "The command did not return output." : "Run a command to see output."}
      />
    );
  }

  if (result.blocks.length === 0) {
    return (
      <OutputState
        tone={result.status === "error" ? "error" : "idle"}
        title={result.status === "error" ? "Command failed" : "Empty output"}
        text={
          result.error?.message ??
          (result.status === "error"
            ? "The command returned an error without output."
            : "The command completed without output.")
        }
      />
    );
  }

  return (
    <div
      className={classes(
        "grid max-h-[32rem] min-h-0 gap-3 overflow-y-auto pr-1",
        result.status === "error" && "rounded-md border border-destructive/30 bg-destructive/5 p-3",
      )}
    >
      {result.status === "error" ? (
        <div className="text-destructive text-sm font-medium">
          {result.error?.message ?? "Command returned an error result."}
        </div>
      ) : null}
      {result.blocks.map((block, index) => (
        <ContentBlockView key={`${block.type}-${index}`} block={block} />
      ))}
    </div>
  );
}

function OutputState({
  tone,
  title,
  text,
}: {
  tone: "idle" | "error";
  title: string;
  text: string;
}) {
  return (
    <div
      className={classes(
        "flex min-h-72 flex-col items-center justify-center rounded-md border border-dashed px-4 text-center",
        tone === "error"
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : "border-border bg-muted/30 text-muted-foreground",
      )}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs">{text}</div>
    </div>
  );
}

function ContentBlockView({ block }: { block: ContentBlock }) {
  const label = getContentBlockLabel(block);
  const text = formatContentBlockText(block);
  const isText = block.type === "text";

  return (
    <section className="border-border bg-card min-h-0 overflow-hidden rounded-md border">
      <div className="border-border bg-muted/40 flex h-8 items-center justify-between border-b px-3">
        <span className="border-border text-foreground inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-4xl border px-2 py-0.5 font-mono text-xs font-medium whitespace-nowrap lowercase">
          {label}
        </span>
      </div>
      <pre
        className={classes(
          "max-h-96 min-h-0 overflow-auto p-3 text-sm leading-6",
          isText
            ? "font-sans whitespace-pre-wrap"
            : "bg-muted/20 font-mono whitespace-pre min-w-full",
        )}
      >
        {text}
      </pre>
    </section>
  );
}

function classes(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function getContentBlockLabel(block: ContentBlock): string {
  if (block.type === "code") {
    return block.language ?? "code";
  }

  return block.type;
}

function formatContentBlockText(block: ContentBlock): string {
  if (block.type === "json") {
    return JSON.stringify(block.value, null, 2);
  }

  return block.text;
}
