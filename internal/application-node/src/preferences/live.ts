import type { JsonValue } from "@tooldeck/protocol";
import { Effect, Layer, Schema } from "effect";

import type { ApplicationEffect } from "@/application/effect";
import { tryApplicationSync } from "@/application/effect";
import { Preferences, type PreferencesService } from "@/preferences/context";
import {
  getPreferenceDefinition,
  listPreferenceDefinitions,
  type PreferenceDefinition,
} from "@/preferences/definitions";
import {
  GetApplicationPreferenceRequestSchema,
  ListApplicationPreferencesRequestSchema,
  SetApplicationPreferenceRequestSchema,
} from "@/preferences/schema";
import type {
  ApplicationPreference,
  GetApplicationPreferenceRequest,
  ListApplicationPreferencesRequest,
  SetApplicationPreferenceRequest,
} from "@/preferences/types";
import { ApplicationStorage } from "@/storage/context";
import type { PreferenceRepository, PreferenceRow } from "@/storage/repositories";
import {
  decodeApplicationRequest,
  makeInvalidApplicationRequest,
} from "@/validation/effect-schema";

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
        const decoded = yield* decodeApplicationRequest(
          ListApplicationPreferencesRequestSchema,
          request,
          "preferences.list",
        );
        const preferences = yield* getPreferences();
        const scopes = decoded.scopes ? new Set(decoded.scopes) : undefined;
        const definitions = listPreferenceDefinitions().filter(
          (definition) => !scopes || scopes.has(definition.scope),
        );

        return yield* Effect.forEach(definitions, (definition) =>
          formatPreference(definition, preferences.getRow(definition.scope, definition.key)),
        );
      }),
    get: (request: GetApplicationPreferenceRequest) =>
      Effect.gen(function* () {
        const decoded = yield* decodeApplicationRequest(
          GetApplicationPreferenceRequestSchema,
          request,
          "preferences.get",
        );
        const definition = yield* resolvePreferenceDefinition(decoded, "preferences.get");
        const preferences = yield* getPreferences();
        return yield* formatPreference(
          definition,
          preferences.getRow(definition.scope, definition.key),
        );
      }),
    set: (request: SetApplicationPreferenceRequest) =>
      Effect.gen(function* () {
        const decoded = yield* decodeApplicationRequest(
          SetApplicationPreferenceRequestSchema,
          request,
          "preferences.set",
        );
        const definition = yield* resolvePreferenceDefinition(decoded, "preferences.set");
        const value = yield* decodePreferenceValue(
          definition,
          decoded.value,
          "preferences.set",
          "ERR_INVALID_ARGUMENT",
        );
        const preferences = yield* getPreferences();
        const row = yield* tryApplicationSync(() =>
          preferences.set({
            scope: definition.scope,
            key: definition.key,
            value,
          }),
        );

        return yield* formatPreference(definition, row);
      }),
    delete: (request: GetApplicationPreferenceRequest) =>
      Effect.gen(function* () {
        const decoded = yield* decodeApplicationRequest(
          GetApplicationPreferenceRequestSchema,
          request,
          "preferences.delete",
        );
        const definition = yield* resolvePreferenceDefinition(decoded, "preferences.delete");
        const preferences = yield* getPreferences();
        yield* tryApplicationSync(() => {
          preferences.delete(definition.scope, definition.key);
        });
      }),
  });
}

function formatPreference(
  definition: PreferenceDefinition,
  row: PreferenceRow | undefined,
): ApplicationEffect<ApplicationPreference> {
  return Effect.gen(function* () {
    const value = row
      ? yield* decodeStoredPreferenceValue(definition, row.valueJson)
      : definition.defaultValue;

    return {
      scope: definition.scope,
      key: definition.key,
      value,
      defaultValue: definition.defaultValue,
      description: definition.description,
      valueType: definition.valueType,
      ...(definition.values ? { values: definition.values } : {}),
      ...(row ? { updatedAt: row.updatedAt } : {}),
    };
  });
}

function resolvePreferenceDefinition(
  request: GetApplicationPreferenceRequest,
  operation: string,
): ApplicationEffect<PreferenceDefinition> {
  const definition = getPreferenceDefinition(request.scope, request.key);

  if (definition) {
    return Effect.succeed(definition);
  }

  return Effect.fail(
    makeInvalidApplicationRequest({
      operation,
      path: "/key",
      message: `Unsupported preference key: ${request.scope}.${request.key}`,
    }),
  );
}

function decodeStoredPreferenceValue(
  definition: PreferenceDefinition,
  valueJson: string,
): ApplicationEffect<JsonValue> {
  return Effect.gen(function* () {
    const value: unknown = yield* tryApplicationSync(() => JSON.parse(valueJson));
    return yield* decodePreferenceValue(definition, value, "preferences.read", "ERR_UNKNOWN");
  });
}

function decodePreferenceValue(
  definition: PreferenceDefinition,
  value: unknown,
  operation: string,
  errorCode: "ERR_INVALID_ARGUMENT" | "ERR_UNKNOWN",
): ApplicationEffect<JsonValue> {
  if (definition.valueType === "boolean") {
    const message = `Preference ${definition.key} must be a boolean value`;

    return decodeApplicationRequest(Schema.Boolean, value, operation, {
      errorCode,
      message,
      pathPrefix: ["value"],
    });
  }

  const message = `Preference ${definition.key} must be one of: ${definition.values?.join(", ") ?? ""}`;
  const valueSchema = Schema.String.pipe(
    Schema.filter((candidate) => definition.values?.includes(candidate) === true, {
      message: () => message,
    }),
  );

  return decodeApplicationRequest(valueSchema, value, operation, {
    errorCode,
    message,
    pathPrefix: ["value"],
  });
}
