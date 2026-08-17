import type { TooldeckApplication } from "@tooldeck/application-node";

import { desktopIpcChannels } from "@/shared/ipc";

import { toDesktopCommand } from "../desktop-contract/catalog";
import { decodeListCommandsRequest, decodeRunCommandRequest } from "./codecs/requests";
import type { DesktopIpcRegistrar } from "./register";

export function registerCommandsIpc(
  registrar: DesktopIpcRegistrar,
  application: TooldeckApplication,
): void {
  registrar.register(desktopIpcChannels.commands.list, async (value) => {
    const request = decodeListCommandsRequest(value);
    const [commands, plugins] = await Promise.all([
      application.commands.list(request),
      application.plugins.list(request),
    ]);
    const pluginsById = new Map(plugins.map((plugin) => [plugin.id, plugin]));

    return commands.map((command) => toDesktopCommand(command, pluginsById.get(command.pluginId)));
  });
  registrar.register(desktopIpcChannels.commands.run, (value) => {
    const request = decodeRunCommandRequest(value);

    return application.commands.run({
      ...request,
      source: "desktop",
      recordHistory: true,
    });
  });
}
