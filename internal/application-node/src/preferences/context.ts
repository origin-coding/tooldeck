import { Context } from "effect";

import type { ApplicationEffect } from "@/application/effect";
import type {
  ApplicationPreference,
  GetApplicationPreferenceRequest,
  ListApplicationPreferencesRequest,
  SetApplicationPreferenceRequest,
} from "@/preferences/facade-types";

export interface PreferencesService {
  list(request?: ListApplicationPreferencesRequest): ApplicationEffect<ApplicationPreference[]>;
  get(request: GetApplicationPreferenceRequest): ApplicationEffect<ApplicationPreference>;
  set(request: SetApplicationPreferenceRequest): ApplicationEffect<ApplicationPreference>;
  delete(request: GetApplicationPreferenceRequest): ApplicationEffect<void>;
}

export class Preferences extends Context.Tag("@tooldeck/application-node/Preferences")<
  Preferences,
  PreferencesService
>() {}
