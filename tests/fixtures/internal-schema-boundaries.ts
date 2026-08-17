export type ApplicationBoundaryOperation =
  | "commands.list"
  | "commands.run"
  | "plugins.list"
  | "plugins.rescan"
  | "plugins.setEnabled"
  | "plugins.installPackage"
  | "plugins.uninstall"
  | "plugins.purgeData"
  | "preferences.list"
  | "preferences.get"
  | "preferences.set"
  | "preferences.delete"
  | "history.listRuns";

export interface InternalBoundarySuccessFixture {
  id: string;
  operation: ApplicationBoundaryOperation;
  desktopChannel?: string;
  request: unknown;
}

export interface InternalBoundaryFailureFixture extends InternalBoundarySuccessFixture {
  expectedPath: string;
}

export const internalBoundarySuccessFixtures: readonly InternalBoundarySuccessFixture[] = [
  {
    id: "commands-list-locale",
    operation: "commands.list",
    desktopChannel: "tooldeck:list-commands",
    request: { locale: "zh-CN" },
  },
  {
    id: "plugins-list-locale",
    operation: "plugins.list",
    desktopChannel: "tooldeck:list-plugins",
    request: { locale: "en-US" },
  },
  {
    id: "plugins-rescan-locale",
    operation: "plugins.rescan",
    desktopChannel: "tooldeck:rescan-plugins",
    request: { locale: "zh-CN" },
  },
  {
    id: "preferences-list-scopes",
    operation: "preferences.list",
    request: { scopes: ["shared", "desktop"] },
  },
  {
    id: "preferences-get",
    operation: "preferences.get",
    desktopChannel: "tooldeck:get-preference",
    request: { scope: "desktop", key: "sidebar.collapsed" },
  },
  {
    id: "preferences-set",
    operation: "preferences.set",
    desktopChannel: "tooldeck:set-preference",
    request: { scope: "desktop", key: "sidebar.collapsed", value: true },
  },
  {
    id: "preferences-delete",
    operation: "preferences.delete",
    request: { scope: "desktop", key: "sidebar.collapsed" },
  },
  {
    id: "history-list-limit",
    operation: "history.listRuns",
    desktopChannel: "tooldeck:list-command-runs",
    request: { limit: 25, commandId: "fixture.echo" },
  },
];

export const internalBoundaryFailureFixtures: readonly InternalBoundaryFailureFixture[] = [
  {
    id: "commands-list-invalid-locale",
    operation: "commands.list",
    desktopChannel: "tooldeck:list-commands",
    request: { locale: 42 },
    expectedPath: "/locale",
  },
  {
    id: "commands-list-unexpected-property",
    operation: "commands.list",
    desktopChannel: "tooldeck:list-commands",
    request: { locale: "en-US", unexpected: true },
    expectedPath: "/unexpected",
  },
  {
    id: "commands-run-missing-command-id",
    operation: "commands.run",
    desktopChannel: "tooldeck:run-command",
    request: { input: {} },
    expectedPath: "/commandId",
  },
  {
    id: "plugins-list-invalid-locale",
    operation: "plugins.list",
    desktopChannel: "tooldeck:list-plugins",
    request: { locale: false },
    expectedPath: "/locale",
  },
  {
    id: "plugins-rescan-invalid-locale",
    operation: "plugins.rescan",
    desktopChannel: "tooldeck:rescan-plugins",
    request: { locale: 42 },
    expectedPath: "/locale",
  },
  {
    id: "plugins-set-enabled-invalid-fields",
    operation: "plugins.setEnabled",
    desktopChannel: "tooldeck:set-plugin-enabled",
    request: { pluginId: "", enabled: "yes", locale: "en-US" },
    expectedPath: "/enabled",
  },
  {
    id: "plugins-install-invalid-package-path",
    operation: "plugins.installPackage",
    desktopChannel: "tooldeck:install-plugin-package",
    request: { packagePath: 42, locale: "en-US" },
    expectedPath: "/packagePath",
  },
  {
    id: "plugins-uninstall-invalid-plugin-id",
    operation: "plugins.uninstall",
    desktopChannel: "tooldeck:uninstall-plugin",
    request: { pluginId: false, locale: "en-US" },
    expectedPath: "/pluginId",
  },
  {
    id: "plugins-purge-empty-plugin-id",
    operation: "plugins.purgeData",
    desktopChannel: "tooldeck:purge-plugin-data",
    request: { pluginId: "" },
    expectedPath: "/pluginId",
  },
  {
    id: "preferences-list-invalid-scopes",
    operation: "preferences.list",
    request: { scopes: "shared" },
    expectedPath: "/scopes",
  },
  {
    id: "preferences-get-invalid-scope",
    operation: "preferences.get",
    desktopChannel: "tooldeck:get-preference",
    request: { scope: "renderer", key: "sidebar.collapsed" },
    expectedPath: "/scope",
  },
  {
    id: "preferences-set-invalid-value",
    operation: "preferences.set",
    desktopChannel: "tooldeck:set-preference",
    request: { scope: "desktop", key: "sidebar.collapsed", value: "false" },
    expectedPath: "/value",
  },
  {
    id: "preferences-delete-invalid-key",
    operation: "preferences.delete",
    request: { scope: "desktop", key: 42 },
    expectedPath: "/key",
  },
  {
    id: "history-list-invalid-limit",
    operation: "history.listRuns",
    desktopChannel: "tooldeck:list-command-runs",
    request: { limit: 0 },
    expectedPath: "/limit",
  },
];
