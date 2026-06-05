import { cn } from "@/renderer/lib/utils";

export function EmptyState({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-24 items-center justify-center text-sm text-muted-foreground",
        className,
      )}
    >
      {text}
    </div>
  );
}
