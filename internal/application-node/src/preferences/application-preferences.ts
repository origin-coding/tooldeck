import type { JsonValue } from "@tooldeck/protocol";

import { runApplicationOperation } from "@/application/edge";
import { ApplicationError } from "@/errors/application-error";
import type {
  ApplicationPreference,
  ApplicationPreferenceFacade,
  GetApplicationPreferenceRequest,
  ListApplicationPreferencesRequest,
  SetApplicationPreferenceRequest,
} from "@/preferences/facade-types";
import {
  listPreferenceDefinitions,
  requirePreferenceDefinition,
  validatePreferenceValue,
  type PreferenceDefinition,
} from "@/preferences/preferences";
import type { PreferenceRepository, PreferenceRow } from "@/storage";

export interface ApplicationPreferenceDependencies {
  readonly getPreferences: () => Pick<PreferenceRepository, "getRow" | "set" | "delete">;
}

export class ApplicationPreferences implements ApplicationPreferenceFacade {
  constructor(private readonly dependencies: ApplicationPreferenceDependencies) {}

  list(request: ListApplicationPreferencesRequest = {}): Promise<ApplicationPreference[]> {
    return runApplicationOperation(() => {
      const scopes = request.scopes ? new Set(request.scopes) : undefined;
      const preferences = this.dependencies.getPreferences();

      return listPreferenceDefinitions()
        .filter((definition) => !scopes || scopes.has(definition.scope))
        .map((definition) =>
          formatPreference(definition, preferences.getRow(definition.scope, definition.key)),
        );
    });
  }

  get(request: GetApplicationPreferenceRequest): Promise<ApplicationPreference> {
    return runApplicationOperation(() => {
      assertPreferenceRequest(request);
      const definition = requirePreferenceDefinition(request.scope, request.key);

      return formatPreference(
        definition,
        this.dependencies.getPreferences().getRow(definition.scope, definition.key),
      );
    });
  }

  set(request: SetApplicationPreferenceRequest): Promise<ApplicationPreference> {
    return runApplicationOperation(() => {
      assertPreferenceRequest(request);
      const definition = requirePreferenceDefinition(request.scope, request.key);
      const value = validatePreferenceValue(definition.scope, definition.key, request.value);
      const row = this.dependencies.getPreferences().set({
        scope: definition.scope,
        key: definition.key,
        value,
      });

      return formatPreference(definition, row);
    });
  }

  delete(request: GetApplicationPreferenceRequest): Promise<void> {
    return runApplicationOperation(() => {
      assertPreferenceRequest(request);
      const definition = requirePreferenceDefinition(request.scope, request.key);

      this.dependencies.getPreferences().delete(definition.scope, definition.key);
    });
  }
}

function formatPreference(
  definition: PreferenceDefinition,
  row: PreferenceRow | undefined,
): ApplicationPreference {
  return {
    scope: definition.scope,
    key: definition.key,
    value: row
      ? (validatePreferenceValue(
          definition.scope,
          definition.key,
          JSON.parse(row.valueJson),
        ) as JsonValue)
      : (definition.defaultValue as JsonValue),
    defaultValue: definition.defaultValue,
    description: definition.description,
    valueType: definition.valueType,
    ...(definition.values ? { values: definition.values } : {}),
    ...(row ? { updatedAt: row.updatedAt } : {}),
  };
}

function assertPreferenceRequest(
  request: GetApplicationPreferenceRequest,
): asserts request is GetApplicationPreferenceRequest {
  if (!request || typeof request.scope !== "string" || typeof request.key !== "string") {
    throw new ApplicationError({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "Preference operations require a scope and key.",
    });
  }
}
