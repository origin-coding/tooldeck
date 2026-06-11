import type { MenuDataItem } from "@ant-design/pro-components";
import { Boxes, Search, Wrench } from "lucide-react";
import type { ReactNode } from "react";

import type { DesktopNavigationMode } from "@/renderer/app/types";
import type { DesktopCommand, DesktopPlugin } from "@/shared/desktop-api";

export type SidebarRoute = MenuDataItem & {
  path: string;
  key: string;
  name: string;
  locale: false;
  icon?: ReactNode;
  children?: SidebarRoute[];
  disabled?: boolean;
  kind?: "command" | "plugin";
  commandId?: string;
  pluginId?: string;
  onTitleClick?: () => void;
};

export function createSidebarRoutes({
  mode,
  commands,
  plugins,
  labels,
  onOpenSearch,
  onSelectCommand,
  onSelectPlugin,
}: {
  mode: DesktopNavigationMode;
  commands: DesktopCommand[];
  plugins: DesktopPlugin[];
  labels: {
    search: string;
    commands: string;
    plugins: string;
    noCommandsFound: string;
    noPluginsFound: string;
  };
  onOpenSearch(): void;
  onSelectCommand(command: DesktopCommand): void;
  onSelectPlugin(plugin: DesktopPlugin): void;
}): SidebarRoute[] {
  const searchRoute: SidebarRoute = {
    path: "/search",
    key: "search",
    name: labels.search,
    locale: false,
    icon: <Search size={15} />,
    onTitleClick: onOpenSearch,
  };

  if (mode === "entry-first") {
    const commandRoutes: SidebarRoute[] =
      commands.length > 0
        ? commands.map((command) => ({
            path: `/commands/${encodeURIComponent(command.id)}`,
            key: `command:${command.id}`,
            name: command.title,
            locale: false,
            icon: <Wrench size={15} />,
            kind: "command",
            commandId: command.id,
            onTitleClick: () => onSelectCommand(command),
          }))
        : [
            {
              path: "/commands/empty",
              key: "commands-empty",
              name: labels.noCommandsFound,
              locale: false,
              icon: <Wrench size={15} />,
              disabled: true,
            },
          ];

    return [
      searchRoute,
      {
        path: "/commands",
        key: "commands",
        name: labels.commands,
        locale: false,
        children: commandRoutes,
      },
    ];
  }

  const pluginRoutes: SidebarRoute[] =
    plugins.length > 0
      ? plugins.map((plugin) => ({
          path: `/plugins/${encodeURIComponent(plugin.id)}`,
          key: `plugin:${plugin.id}`,
          name: plugin.name,
          locale: false,
          icon: <Boxes size={15} />,
          kind: "plugin",
          pluginId: plugin.id,
          onTitleClick: () => onSelectPlugin(plugin),
        }))
      : [
          {
            path: "/plugins/empty",
            key: "plugins-empty",
            name: labels.noPluginsFound,
            locale: false,
            icon: <Boxes size={15} />,
            disabled: true,
          },
        ];

  return [
    searchRoute,
    {
      path: "/plugins",
      key: "plugins",
      name: labels.plugins,
      locale: false,
      children: pluginRoutes,
    },
  ];
}
