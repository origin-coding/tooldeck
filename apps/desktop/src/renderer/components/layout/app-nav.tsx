import { Button } from "antd";
import { Boxes, Braces, Wrench } from "lucide-react";

import type { AppView } from "@/renderer/app/types";

export function AppNav({ view, onChange }: { view: AppView; onChange(view: AppView): void }) {
  return (
    <nav className="icon-nav">
      <div className="brand-mark">
        <Braces size={18} />
      </div>
      <NavButton
        active={view === "commands"}
        icon={<Wrench size={18} />}
        label="Commands"
        onClick={() => onChange("commands")}
      />
      <NavButton
        active={view === "plugins"}
        icon={<Boxes size={18} />}
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
      className={active ? "icon-nav-button icon-nav-button-active" : "icon-nav-button"}
      htmlType="button"
      aria-label={label}
      icon={icon}
      title={label}
      onClick={onClick}
    />
  );
}
