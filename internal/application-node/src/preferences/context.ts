import { Context } from "effect";

import type { ApplicationEffect } from "@/application/effect";
import type {
  ApplicationPreference,
  GetApplicationPreferenceRequest,
  ListApplicationPreferencesRequest,
  SetApplicationPreferenceRequest,
} from "@/preferences/types";

export class Preferences extends Context.Tag("@tooldeck/application-node/Preferences")<
  Preferences,
  {
    readonly list: (
      request?: ListApplicationPreferencesRequest,
    ) => ApplicationEffect<ApplicationPreference[]>;
    readonly get: (
      request: GetApplicationPreferenceRequest,
    ) => ApplicationEffect<ApplicationPreference>;
    readonly set: (
      request: SetApplicationPreferenceRequest,
    ) => ApplicationEffect<ApplicationPreference>;
    readonly delete: (request: GetApplicationPreferenceRequest) => ApplicationEffect<void>;
  }
>() {}

export type PreferencesService = Context.Tag.Service<typeof Preferences>;
