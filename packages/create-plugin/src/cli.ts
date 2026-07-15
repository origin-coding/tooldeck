import { defineCommand } from "citty";
import { consola } from "consola";

import { parseCreatePluginArgs } from "./args";
import {
  createPluginProject,
  createTemplateData,
  type CreatePluginProjectOptions,
} from "./scaffold";

type ClackModule = {
  intro(message: string): void;
  outro(message: string): void;
  text(options: {
    message: string;
    initialValue?: string;
    placeholder?: string;
    validate?: (value: string) => string | void;
  }): Promise<string | symbol>;
  confirm(options: { message: string; initialValue?: boolean }): Promise<boolean | symbol>;
  isCancel(value: unknown): boolean;
  cancel(message: string): void;
};

type NypmModule = {
  installDependencies?: (options: { cwd: string }) => Promise<void>;
};

export function createCreatePluginCommand() {
  return defineCommand({
    meta: {
      name: "create-tooldeck-plugin",
      description: "Create a Tooldeck plugin project from a local template.",
    },
    async run({ rawArgs }) {
      const parsed = parseCreatePluginArgs(rawArgs);
      const options = await resolveCreatePluginOptions(parsed);
      const result = await createPluginProject(options);

      if (parsed.install ?? false) {
        await installDependencies(result.projectDir);
      }

      consola.success(`Created ${result.data.pluginName} in ${result.projectDir}`);
      consola.info("Next steps:");
      consola.info(`  cd ${result.data.projectName}`);

      if (!(parsed.install ?? false)) {
        consola.info("  pnpm install");
      }

      consola.info("  pnpm check");
      consola.info("  pnpm build");
    },
  });
}

async function resolveCreatePluginOptions(
  parsed: ReturnType<typeof parseCreatePluginArgs>,
): Promise<CreatePluginProjectOptions> {
  if (parsed.template && parsed.template !== "plugin-node-vite") {
    throw new Error(
      `Unsupported template: ${parsed.template}. Only plugin-node-vite is available.`,
    );
  }

  if (parsed.yes) {
    if (!parsed.name) {
      throw new Error("Plugin name is required when using --yes.");
    }

    return {
      name: parsed.name,
      pluginId: parsed.pluginId,
      pluginName: parsed.pluginName,
      commandId: parsed.commandId,
      template: parsed.template,
    };
  }

  if (!shouldPrompt(parsed)) {
    if (!parsed.name) {
      throw new Error("Plugin name is required.");
    }

    return {
      name: parsed.name,
      pluginId: parsed.pluginId,
      pluginName: parsed.pluginName,
      commandId: parsed.commandId,
      template: parsed.template,
    };
  }

  const prompts = await loadClack();

  prompts.intro("Create Tooldeck plugin");

  const name = parsed.name ?? (await promptText(prompts, "Project name", "my-tooldeck-plugin"));
  const defaults = createTemplateData(name, parsed);
  const pluginId =
    parsed.pluginId ??
    (await promptText(prompts, "Plugin ID", defaults.pluginId, validatePromptId("Plugin ID")));
  const pluginName =
    parsed.pluginName ?? (await promptText(prompts, "Plugin display name", defaults.pluginName));
  const commandId =
    parsed.commandId ??
    (await promptText(
      prompts,
      "Example command ID",
      defaults.commandId,
      validatePromptId("Command ID"),
    ));
  const install =
    parsed.install ?? (await promptConfirm(prompts, "Install dependencies now?", false));

  prompts.outro("Scaffolding project");

  parsed.install = install;

  return {
    name,
    pluginId,
    pluginName,
    commandId,
    template: parsed.template,
  };
}

function shouldPrompt(parsed: ReturnType<typeof parseCreatePluginArgs>): boolean {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }

  return (
    !parsed.name ||
    !parsed.pluginId ||
    !parsed.pluginName ||
    !parsed.commandId ||
    parsed.install === undefined
  );
}

async function promptText(
  prompts: ClackModule,
  message: string,
  initialValue: string,
  validate?: (value: string) => string | void,
): Promise<string> {
  const value = await prompts.text({
    message,
    initialValue,
    validate,
  });

  if (prompts.isCancel(value)) {
    prompts.cancel("Create plugin cancelled.");
    throw new Error("Create plugin cancelled.");
  }

  return String(value);
}

async function promptConfirm(
  prompts: ClackModule,
  message: string,
  initialValue: boolean,
): Promise<boolean> {
  const value = await prompts.confirm({
    message,
    initialValue,
  });

  if (prompts.isCancel(value)) {
    prompts.cancel("Create plugin cancelled.");
    throw new Error("Create plugin cancelled.");
  }

  return Boolean(value);
}

function validatePromptId(label: string): (value: string) => string | void {
  return (value) => {
    try {
      createTemplateData(
        "plugin",
        label === "Plugin ID" ? { pluginId: value } : { commandId: value },
      );
      return undefined;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };
}

async function installDependencies(cwd: string): Promise<void> {
  const nypm = (await import("nypm")) as unknown as NypmModule;

  if (!nypm.installDependencies) {
    throw new Error("The installed nypm package does not expose installDependencies().");
  }

  await nypm.installDependencies({ cwd });
}

async function loadClack(): Promise<ClackModule> {
  return (await import("@clack/prompts")) as unknown as ClackModule;
}
