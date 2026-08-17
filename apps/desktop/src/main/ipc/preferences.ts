import type { TooldeckApplication } from "@tooldeck/application-node";

import { desktopIpcChannels } from "@/shared/ipc";

import { toDesktopPreference } from "../desktop-contract/catalog";
import { decodeGetPreferenceRequest, decodeSetPreferenceRequest } from "./codecs/requests";
import type { DesktopIpcRegistrar } from "./register";

export function registerPreferencesIpc(
  registrar: DesktopIpcRegistrar,
  application: TooldeckApplication,
): void {
  registrar.register(desktopIpcChannels.preferences.list, async () =>
    (
      await application.preferences.list({
        scopes: ["shared", "desktop"],
      })
    ).map(toDesktopPreference),
  );
  registrar.register(desktopIpcChannels.preferences.get, async (value) =>
    toDesktopPreference(await application.preferences.get(decodeGetPreferenceRequest(value))),
  );
  registrar.register(desktopIpcChannels.preferences.set, async (value) => {
    const request = decodeSetPreferenceRequest(value);

    return toDesktopPreference(await application.preferences.set(request));
  });
}
