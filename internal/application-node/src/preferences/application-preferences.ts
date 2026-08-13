import { runApplicationEffect } from "@/application/edge";
import type { PreferencesService } from "@/preferences/context";
import type {
  ApplicationPreference,
  ApplicationPreferenceFacade,
  GetApplicationPreferenceRequest,
  ListApplicationPreferencesRequest,
  SetApplicationPreferenceRequest,
} from "@/preferences/facade-types";

export class ApplicationPreferences implements ApplicationPreferenceFacade {
  constructor(private readonly service: PreferencesService) {}

  list(request: ListApplicationPreferencesRequest = {}): Promise<ApplicationPreference[]> {
    return runApplicationEffect(this.service.list(request));
  }

  get(request: GetApplicationPreferenceRequest): Promise<ApplicationPreference> {
    return runApplicationEffect(this.service.get(request));
  }

  set(request: SetApplicationPreferenceRequest): Promise<ApplicationPreference> {
    return runApplicationEffect(this.service.set(request));
  }

  delete(request: GetApplicationPreferenceRequest): Promise<void> {
    return runApplicationEffect(this.service.delete(request));
  }
}
