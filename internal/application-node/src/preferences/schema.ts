import { Schema } from "effect";

import type {
  GetApplicationPreferenceRequest,
  ListApplicationPreferencesRequest,
  SetApplicationPreferenceRequest,
} from "@/preferences/types";

export const PreferenceScopeSchema = Schema.Literal("cli", "desktop", "shared");

export const ListApplicationPreferencesRequestSchema = Schema.Struct({
  scopes: Schema.optional(Schema.Array(PreferenceScopeSchema)),
}) satisfies Schema.Schema<ListApplicationPreferencesRequest>;

export const GetApplicationPreferenceRequestSchema = Schema.Struct({
  scope: PreferenceScopeSchema,
  key: Schema.String,
}) satisfies Schema.Schema<GetApplicationPreferenceRequest>;

export const SetApplicationPreferenceRequestSchema = Schema.Struct({
  scope: PreferenceScopeSchema,
  key: Schema.String,
  value: Schema.Unknown,
}) satisfies Schema.Schema<SetApplicationPreferenceRequest>;
