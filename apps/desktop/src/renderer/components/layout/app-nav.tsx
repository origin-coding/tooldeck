import { Boxes, Braces, Wrench } from "lucide-react";

import type { AppView } from "@/renderer/app/types";
import { Button } from "@/renderer/components/ui/button";

export function AppNav({ view, onChange }: { view: AppView; onChange(view: AppView): void }) {
  return (
    <nav className="border-border bg-background flex min-h-0 flex-col items-center gap-2 border-r px-2 py-3">
      <div className="bg-primary text-primary-foreground mb-2 flex size-10 items-center justify-center rounded-lg">
        <Braces className="size-5" />
      </div>
      <NavButton
        active={view === "commands"}
        icon={<Wrench className="size-5" />}
        label="Commands"
        onClick={() => onChange("commands")}
      />
      <NavButton
        active={view === "plugins"}
        icon={<Boxes className="size-5" />}
        label="Plugins"
        onClick={() => onChange("plugins")}
      />
    </nav>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick(): void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-lg"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {icon}
    </Button>
  );
}
