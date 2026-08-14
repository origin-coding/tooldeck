import type { JsonValue } from "@tooldeck/protocol";

import type { PreferenceScope } from "@/preferences/definitions";

export interface ApplicationPreference {
  scope: PreferenceScope;
  key: string;
  value: JsonValue;
  defaultValue: JsonValue;
  description: string;
  valueType: "boolean" | "enum";
  values?: readonly string[];
  updatedAt?: number;
}

export interface GetApplicationPreferenceRequest {
  scope: PreferenceScope;
  key: string;
}

export interface SetApplicationPreferenceRequest extends GetApplicationPreferenceRequest {
  value: JsonValue;
}

export interface ListApplicationPreferencesRequest {
  scopes?: readonly PreferenceScope[];
}

export interface ApplicationPreferenceFacade {
  list(request?: ListApplicationPreferencesRequest): Promise<ApplicationPreference[]>;
  get(request: GetApplicationPreferenceRequest): Promise<ApplicationPreference>;
  set(request: SetApplicationPreferenceRequest): Promise<ApplicationPreference>;
  delete(request: GetApplicationPreferenceRequest): Promise<void>;
}
