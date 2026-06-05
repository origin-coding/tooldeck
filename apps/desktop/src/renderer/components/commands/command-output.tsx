import type { CommandResult, ContentBlock } from "@tooldeck/protocol";

export function CommandOutput({ result, hasError }: { result?: CommandResult; hasError: boolean }) {
  if (!result) {
    return (
      <div className="border-border bg-muted/30 text-muted-foreground flex min-h-72 items-center justify-center rounded-md border border-dashed text-sm">
        {hasError ? "Command failed" : "Run a command to see output"}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {result.blocks.map((block, index) => (
        <pre
          key={`${block.type}-${index}`}
          className="bg-muted min-h-0 overflow-auto rounded-md p-3 font-mono text-sm leading-6 whitespace-pre-wrap"
        >
          {formatContentBlockText(block)}
        </pre>
      ))}
    </div>
  );
}

function formatContentBlockText(block: ContentBlock): string {
  if (block.type === "json") {
    return JSON.stringify(block.value, null, 2);
  }

  return block.text;
}
