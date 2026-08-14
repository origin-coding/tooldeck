import type { JsonValue } from "@tooldeck/protocol";
import { Effect, Layer } from "effect";

import type { ApplicationEffect } from "@/application/effect";
import { tryApplicationSync } from "@/application/effect";
import { ApplicationError } from "@/errors/error";
import { Preferences, type PreferencesService } from "@/preferences/context";
import {
  listPreferenceDefinitions,
  requirePreferenceDefinition,
  validatePreferenceValue,
  type PreferenceDefinition,
} from "@/preferences/definitions";
import type {
  ApplicationPreference,
  GetApplicationPreferenceRequest,
  ListApplicationPreferencesRequest,
  SetApplicationPreferenceRequest,
} from "@/preferences/types";
import { ApplicationStorage } from "@/storage/context";
import type { PreferenceRepository, PreferenceRow } from "@/storage/repositories";

export function makePreferencesLive(): Layer.Layer<Preferences, never, ApplicationStorage> {
  return Layer.effect(
    Preferences,
    Effect.gen(function* () {
      const storage = yield* ApplicationStorage;
      return makePreferencesService(() => Effect.succeed(storage.repositories.preferences));
    }),
  );
}

export function makePreferencesService(
  getPreferences: () => ApplicationEffect<Pick<PreferenceRepository, "getRow" | "set" | "delete">>,
): PreferencesService {
  return Object.freeze({
    list: (request: ListApplicationPreferencesRequest = {}) =>
      Effect.gen(function* () {
        const preferences = yield* getPreferences();
        return yield* tryApplicationSync(() => {
          const scopes = request.scopes ? new Set(request.scopes) : undefined;

          return listPreferenceDefinitions()
            .filter((definition) => !scopes || scopes.has(definition.scope))
            .map((definition) =>
              formatPreference(definition, preferences.getRow(definition.scope, definition.key)),
            );
        });
      }),
    get: (request: GetApplicationPreferenceRequest) =>
      Effect.gen(function* () {
        const preferences = yield* getPreferences();
        return yield* tryApplicationSync(() => {
          assertPreferenceRequest(request);
          const definition = requirePreferenceDefinition(request.scope, request.key);

          return formatPreference(definition, preferences.getRow(definition.scope, definition.key));
        });
      }),
    set: (request: SetApplicationPreferenceRequest) =>
      Effect.gen(function* () {
        const preferences = yield* getPreferences();
        return yield* tryApplicationSync(() => {
          assertPreferenceRequest(request);
          const definition = requirePreferenceDefinition(request.scope, request.key);
          const value = validatePreferenceValue(definition.scope, definition.key, request.value);
          const row = preferences.set({
            scope: definition.scope,
            key: definition.key,
            value,
          });

          return formatPreference(definition, row);
        });
      }),
    delete: (request: GetApplicationPreferenceRequest) =>
      Effect.gen(function* () {
        const preferences = yield* getPreferences();
        return yield* tryApplicationSync(() => {
          assertPreferenceRequest(request);
          const definition = requirePreferenceDefinition(request.scope, request.key);
          preferences.delete(definition.scope, definition.key);
        });
      }),
  });
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
