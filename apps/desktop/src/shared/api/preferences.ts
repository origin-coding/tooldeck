export type DesktopPreferenceScope = "shared" | "desktop";

export interface DesktopPreference {
  scope: DesktopPreferenceScope;
  key: string;
  value: unknown;
  defaultValue: unknown;
  description: string;
  valueType: "boolean" | "enum";
  values?: readonly string[];
  updatedAt?: number;
}

export interface SetPreferenceRequest {
  scope: DesktopPreferenceScope;
  key: string;
  value: unknown;
}

export interface GetPreferenceRequest {
  scope: DesktopPreferenceScope;
  key: string;
}

export interface DesktopPreferencesApi {
  list(): Promise<DesktopPreference[]>;
  get(request: GetPreferenceRequest): Promise<DesktopPreference>;
  set(request: SetPreferenceRequest): Promise<DesktopPreference>;
}
