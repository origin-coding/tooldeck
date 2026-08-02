import type { TooldeckApplication } from "@tooldeck/application-node";
import type { JsonValue } from "@tooldeck/protocol";

import type { GetPreferenceRequest, SetPreferenceRequest } from "@/shared/api";
import { desktopIpcChannels } from "@/shared/ipc";

import { toDesktopPreference } from "../desktop-contract/catalog";
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
    toDesktopPreference(await application.preferences.get(value as GetPreferenceRequest)),
  );
  registrar.register(desktopIpcChannels.preferences.set, async (value) =>
    toDesktopPreference(
      await application.preferences.set({
        ...(value as SetPreferenceRequest),
        value: (value as SetPreferenceRequest).value as JsonValue,
      }),
    ),
  );
}
