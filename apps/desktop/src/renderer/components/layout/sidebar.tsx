import type { AppView } from "@/renderer/app/types";
import { CommandList } from "@/renderer/components/commands/command-list";
import { SearchBox } from "@/renderer/components/layout/search-box";
import { PluginList } from "@/renderer/components/plugins/plugin-list";
import { ScrollArea } from "@/renderer/components/ui/scroll-area";
import { Separator } from "@/renderer/components/ui/separator";
import { Skeleton } from "@/renderer/components/ui/skeleton";
import type { DesktopCommand, DesktopPlugin } from "@/shared/desktop-api";

export function SidebarHeader({ view }: { view: AppView }) {
  return (
    <div className="flex h-16 items-center px-4">
      <div>
        <div className="font-semibold">{view === "commands" ? "Commands" : "Plugins"}</div>
        <div className="text-muted-foreground text-xs">
          {view === "commands" ? "Run contributed tools" : "Manage local plugins"}
        </div>
      </div>
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-16" />
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
      <SearchBox placeholder="Search commands" value={query} onChange={onQueryChange} />
      <ScrollArea className="min-h-0 flex-1 px-3 pb-4">
        {isLoading && commands.length === 0 ? (
          <SidebarSkeleton />
        ) : (
          <CommandList
            commands={commands}
            selectedCommandId={selectedCommandId}
            onSelect={onSelect}
          />
        )}
      </ScrollArea>
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
      <SearchBox placeholder="Search plugins" value={query} onChange={onQueryChange} />
      <ScrollArea className="min-h-0 flex-1 px-3 pb-4">
        {isLoading && plugins.length === 0 ? (
          <SidebarSkeleton />
        ) : (
          <PluginList plugins={plugins} selectedPluginId={selectedPluginId} onSelect={onSelect} />
        )}
      </ScrollArea>
    </>
  );
}

export function SidebarShell({ view, children }: { view: AppView; children: React.ReactNode }) {
  return (
    <aside className="border-border bg-muted/30 flex min-h-0 flex-col border-r max-lg:hidden">
      <SidebarHeader view={view} />
      <Separator />
      {children}
    </aside>
  );
}
