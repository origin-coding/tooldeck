import {
  listPreferenceDefinitions,
  requirePreferenceDefinition,
  validatePreferenceValue,
  type PreferenceDefinition,
} from "@tooldeck/shared";

import type {
  DesktopPreference,
  GetPreferenceRequest,
  SetPreferenceRequest,
} from "@/shared/desktop-api";

import { TooldeckDesktopServiceContext } from "./context";
import { formatDesktopPreference } from "./formatters";
import type { DesktopPreferenceService } from "./types";

export class TooldeckDesktopPreferenceService implements DesktopPreferenceService {
  constructor(private readonly context: TooldeckDesktopServiceContext) {}

  listPreferences(): DesktopPreference[] {
    const preferences = this.context.requirePreferences();

    return listPreferenceDefinitions()
      .filter(isDesktopVisiblePreference)
      .map((definition) =>
        formatDesktopPreference(definition, preferences.getRow(definition.scope, definition.key)),
      );
  }

  getPreference(request: GetPreferenceRequest): DesktopPreference {
    const definition = requirePreferenceDefinition(request.scope, request.key);

    if (!isDesktopVisiblePreference(definition)) {
      throw new Error(`Desktop cannot manage preference: ${request.scope}.${request.key}`);
    }

    return formatDesktopPreference(
      definition,
      this.context.requirePreferences().getRow(definition.scope, definition.key),
    );
  }

  setPreference(request: SetPreferenceRequest): DesktopPreference {
    const definition = requirePreferenceDefinition(request.scope, request.key);

    if (!isDesktopVisiblePreference(definition)) {
      throw new Error(`Desktop cannot manage preference: ${request.scope}.${request.key}`);
    }

    const value = validatePreferenceValue(definition.scope, definition.key, request.value);
    const row = this.context.requirePreferences().set({
      scope: definition.scope,
      key: definition.key,
      value,
    });

    return formatDesktopPreference(definition, row);
  }
}

function isDesktopVisiblePreference(definition: PreferenceDefinition): boolean {
  return definition.scope === "shared" || definition.scope === "desktop";
}
