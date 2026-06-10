import { Button, Divider, Skeleton } from "antd";
import { Boxes, Braces, Settings, Wrench } from "lucide-react";

import type { AppView } from "@/renderer/app/types";
import { CommandList } from "@/renderer/components/commands/command-list";
import { SearchBox } from "@/renderer/components/layout/search-box";
import { PluginList } from "@/renderer/components/plugins/plugin-list";
import type { DesktopCommand, DesktopPlugin } from "@/shared/desktop-api";

export function SidebarHeader({ view }: { view: AppView }) {
  const title = view === "commands" ? "Commands" : view === "plugins" ? "Plugins" : "Settings";
  const description =
    view === "commands"
      ? "Run contributed tools"
      : view === "plugins"
        ? "Manage local plugins"
        : "Desktop preferences";

  return (
    <div className="sidebar-section-header">
      <div className="min-w-0">
        <div className="text-truncate sidebar-section-title">{title}</div>
        <div className="text-truncate sidebar-section-description">{description}</div>
      </div>
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="sidebar-skeleton">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton.Button key={index} active block className="sidebar-skeleton-item" />
      ))}
    </div>
  );
}

export function CommandSidebar({
  commands,
  isLoading,
  query,
  selectedCommandId,
  onQueryChange,
  onSelect,
}: {
  commands: DesktopCommand[];
  isLoading: boolean;
  query: string;
  selectedCommandId?: string;
  onQueryChange(value: string): void;
  onSelect(command: DesktopCommand): void;
}) {
  return (
    <>
      <SidebarHeader view="commands" />
      <SearchBox placeholder="Search commands" value={query} onChange={onQueryChange} />
      <div className="sidebar-scroll">
        {isLoading && commands.length === 0 ? (
          <SidebarSkeleton />
        ) : (
          <CommandList
            commands={commands}
            selectedCommandId={selectedCommandId}
            onSelect={onSelect}
          />
        )}
      </div>
    </>
  );
}

export function PluginSidebar({
  plugins,
  isLoading,
  query,
  selectedPluginId,
  onQueryChange,
  onSelect,
}: {
  plugins: DesktopPlugin[];
  isLoading: boolean;
  query: string;
  selectedPluginId?: string;
  onQueryChange(value: string): void;
  onSelect(plugin: DesktopPlugin): void;
}) {
  return (
    <>
      <SidebarHeader view="plugins" />
      <SearchBox placeholder="Search plugins" value={query} onChange={onQueryChange} />
      <div className="sidebar-scroll">
        {isLoading && plugins.length === 0 ? (
          <SidebarSkeleton />
        ) : (
          <PluginList plugins={plugins} selectedPluginId={selectedPluginId} onSelect={onSelect} />
        )}
      </div>
    </>
  );
}

export function SettingsSidebar() {
  return (
    <>
      <SidebarHeader view="settings" />
      <div className="sidebar-note">Configure the local desktop workspace.</div>
    </>
  );
}

// 中文：把常用工具装进一个桌面
// English：Your everyday tools, all in one desktop

export function AppSidebar({
  view,
  children,
  onChange,
}: {
  view: AppView;
  children: React.ReactNode;
  onChange(view: AppView): void;
}) {
  return (
    <aside className="app-sidebar">
      <div className="brand-row">
        <div className="brand-mark">
          <Braces size={16} />
        </div>
        <div className="min-w-0">
          <div className="text-truncate brand-title">Tooldeck</div>
          <div className="text-truncate brand-subtitle">把常用工具装进一个桌面</div>
        </div>
      </div>
      <Divider className="sidebar-divider" />
      <div className="sidebar-nav">
        <SidebarNavButton
          active={view === "plugins"}
          icon={<Boxes size={15} />}
          label="Plugins"
          onClick={() => onChange("plugins")}
        />
        <SidebarNavButton
          active={view === "commands"}
          icon={<Wrench size={15} />}
          label="Commands"
          onClick={() => onChange("commands")}
        />
      </div>
      <Divider className="sidebar-divider" />
      <div className="sidebar-body">{children}</div>
      <Divider className="sidebar-divider" />
      <div className="sidebar-nav">
        <SidebarNavButton
          active={view === "settings"}
          icon={<Settings size={15} />}
          label="Settings"
          onClick={() => onChange("settings")}
        />
      </div>
    </aside>
  );
}

function SidebarNavButton({
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
      block
      htmlType="button"
      className={classes("sidebar-nav-button", active && "sidebar-nav-button-active")}
      icon={icon}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function classes(...values: Array<string | false>): string {
  return values.filter(Boolean).join(" ");
}
