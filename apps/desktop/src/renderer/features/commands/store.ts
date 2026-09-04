import type { CommandResult } from "@tooldeck/protocol";
import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";

import { getErrorMessage } from "@/renderer/utils/errors";
import { readDesktopSession, writeDesktopSession } from "@/renderer/utils/session";
import type { DesktopCommand } from "@/shared/api";

import {
  buildCommandInput,
  createInputState,
  type CommandInputState,
  type CommandInputValue,
} from "./command-input";

export const useCommandsStore = defineStore("commands", () => {
  const drafts = ref<Record<string, CommandInputState>>({});
  const results = shallowRef<Record<string, CommandResult | undefined>>({});
  const runErrors = ref<Record<string, string | undefined>>({});
  const runningCommandId = ref<string>();

  function restoreDrafts() {
    drafts.value = readDesktopSession().drafts;
  }

  function reconcileDrafts(commands: DesktopCommand[]) {
    for (const command of commands) {
      drafts.value[command.id] = createInputState(command, drafts.value[command.id] ?? {});
    }
  }

  function setInput(commandId: string, key: string, value: CommandInputValue) {
    if (!drafts.value[commandId]) drafts.value[commandId] = {};
    drafts.value[commandId][key] = value;
    writeDesktopSession({ drafts: drafts.value });
  }

  // The app coordinator owns admission and keeps the run occupied through refresh.
  async function execute(command: DesktopCommand, locale: string) {
    runningCommandId.value = command.id;
    results.value = { ...results.value, [command.id]: undefined };
    runErrors.value[command.id] = undefined;
    try {
      const result = await window.tooldeck.commands.run({
        commandId: command.id,
        input: buildCommandInput(command, drafts.value[command.id] ?? {}),
        locale,
      });
      results.value = { ...results.value, [command.id]: result };
    } catch (cause) {
      runErrors.value[command.id] = getErrorMessage(cause);
    }
  }

  function finishRun() {
    runningCommandId.value = undefined;
  }

  return {
    drafts,
    results,
    runErrors,
    runningCommandId,
    restoreDrafts,
    reconcileDrafts,
    setInput,
    execute,
    finishRun,
  };
});
