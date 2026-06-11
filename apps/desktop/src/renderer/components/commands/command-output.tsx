import type { CommandResult, ContentBlock } from "@tooldeck/protocol";
import { Tag } from "antd";
import { useTranslation } from "react-i18next";

export function CommandOutput({ result, hasError }: { result?: CommandResult; hasError: boolean }) {
  const { t } = useTranslation();

  if (!result) {
    return (
      <OutputState
        tone={hasError ? "error" : "idle"}
        title={
          hasError ? t("command.outputState.commandFailed") : t("command.outputState.noOutputYet")
        }
        text={
          hasError
            ? t("command.outputState.commandDidNotReturnOutput")
            : t("command.outputState.runCommandToSeeOutput")
        }
      />
    );
  }

  if (result.blocks.length === 0) {
    return (
      <OutputState
        tone={result.status === "error" ? "error" : "idle"}
        title={
          result.status === "error"
            ? t("command.outputState.commandFailed")
            : t("command.outputState.emptyOutput")
        }
        text={
          result.error?.message ??
          (result.status === "error"
            ? t("command.outputState.errorWithoutOutput")
            : t("command.outputState.completedWithoutOutput"))
        }
      />
    );
  }

  return (
    <div
      className={classes(
        "command-output-list grid max-h-128 min-h-0 gap-3 overflow-y-auto pr-1",
        result.status === "error" &&
          "command-output-list-error rounded-md border border-red-200 bg-red-50 p-3",
      )}
    >
      {result.status === "error" ? (
        <div className="font-semibold text-red-700">
          {result.error?.message ?? t("command.outputState.errorResult")}
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
        "flex min-h-70 flex-col items-center justify-center rounded-md border border-dashed p-4 text-center",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-slate-300 bg-slate-50 text-gray-500",
      )}
    >
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-xs">{text}</div>
    </div>
  );
}

function ContentBlockView({ block }: { block: ContentBlock }) {
  const { t } = useTranslation();
  const label = getContentBlockLabel(block, t("command.outputState.code"));
  const text = formatContentBlockText(block);
  const isText = block.type === "text";

  return (
    <section className="min-h-0 overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="flex h-8 items-center border-b border-slate-200 bg-slate-50 px-2.5">
        <Tag>{label}</Tag>
      </div>
      <pre
        className={classes(
          "content-block-body m-0 max-h-96 min-h-0 overflow-auto p-3 text-[13px] leading-relaxed",
          isText
            ? "whitespace-pre-wrap font-sans"
            : "content-block-body-code min-w-full whitespace-pre bg-slate-50 font-mono",
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

function getContentBlockLabel(block: ContentBlock, codeFallback: string): string {
  if (block.type === "code") {
    return block.language ?? codeFallback;
  }

  return block.type;
}

function formatContentBlockText(block: ContentBlock): string {
  if (block.type === "json") {
    return JSON.stringify(block.value, null, 2);
  }

  return block.text;
}
