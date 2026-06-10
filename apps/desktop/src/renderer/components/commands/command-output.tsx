import type { CommandResult, ContentBlock } from "@tooldeck/protocol";
import { Tag } from "antd";

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
        "command-output-list",
        result.status === "error" && "command-output-list-error",
      )}
    >
      {result.status === "error" ? (
        <div className="command-output-error">
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
        "output-state",
        tone === "error" ? "output-state-error" : "output-state-idle",
      )}
    >
      <div className="output-state-title">{title}</div>
      <div className="output-state-text">{text}</div>
    </div>
  );
}

function ContentBlockView({ block }: { block: ContentBlock }) {
  const label = getContentBlockLabel(block);
  const text = formatContentBlockText(block);
  const isText = block.type === "text";

  return (
    <section className="content-block">
      <div className="content-block-header">
        <Tag>{label}</Tag>
      </div>
      <pre
        className={classes(
          "content-block-body",
          isText ? "content-block-body-text" : "content-block-body-code",
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
