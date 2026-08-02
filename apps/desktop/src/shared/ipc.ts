import type { JsonObject } from "@tooldeck/protocol";

export interface DesktopApiError {
  tag: "ApplicationError";
  source: "application" | "runtime";
  code: string;
  message: string;
  details?: JsonObject;
}

export type DesktopIpcResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: DesktopApiError;
    };

export const desktopIpcChannels = {
  commands: {
    list: "tooldeck:list-commands",
    run: "tooldeck:run-command",
  },
  plugins: {
    list: "tooldeck:list-plugins",
    listDataResidues: "tooldeck:list-plugin-data-residues",
    setEnabled: "tooldeck:set-plugin-enabled",
    installPackage: "tooldeck:install-plugin-package",
    uninstall: "tooldeck:uninstall-plugin",
    purgeData: "tooldeck:purge-plugin-data",
    rescan: "tooldeck:rescan-plugins",
  },
  preferences: {
    list: "tooldeck:list-preferences",
    get: "tooldeck:get-preference",
    set: "tooldeck:set-preference",
  },
  history: {
    listRuns: "tooldeck:list-command-runs",
  },
} as const;

export function isDesktopApiError(value: unknown): value is DesktopApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "tag" in value &&
    value.tag === "ApplicationError" &&
    "message" in value &&
    typeof value.message === "string"
  );
}
