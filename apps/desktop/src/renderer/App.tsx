import type { CommandResult, TooldeckJsonSchema } from "@tooldeck/protocol";
import type { JsonObject } from "@tooldeck/shared";
import { AlertCircle, Braces, History, Loader2, Play, Power, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { CommandRunRecord, DesktopCommand, DesktopPlugin } from "@/shared/desktop-api";

import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { ScrollArea } from "./components/ui/scroll-area";
import { Separator } from "./components/ui/separator";
import { Textarea } from "./components/ui/textarea";
import { cn } from "./lib/utils";

interface AppState {
  commands: DesktopCommand[];
  plugins: DesktopPlugin[];
  selectedCommandId?: string;
  input: Record<string, string>;
  result?: CommandResult;
  history: CommandRunRecord[];
  isLoadingData: boolean;
  isRunning: boolean;
  loadError?: string;
  runError?: string;
}

const initialState: AppState = {
  commands: [],
  plugins: [],
  input: {},
  history: [],
  isLoadingData: false,
  isRunning: false,
};

export function App() {
  const [state, setState] = useState<AppState>(initialState);

  const selectedCommand = useMemo(
    () => state.commands.find((command) => command.id === state.selectedCommandId),
    [state.commands, state.selectedCommandId],
  );

  const loadData = useCallback(async () => {
    setState((current) => ({
      ...current,
      isLoadingData: true,
      loadError: undefined,
    }));

    try {
      const [commands, plugins, history] = await Promise.all([
        window.tooldeck.listCommands(),
        window.tooldeck.listPlugins(),
        window.tooldeck.listCommandRuns(25),
      ]);

      setState((current) => {
        const selectedCommandId = resolveSelectedCommandId(commands, current.selectedCommandId);
        const selected = commands.find((command) => command.id === selectedCommandId);

        return {
          ...current,
          commands,
          plugins,
          selectedCommandId,
          input: createInputState(selected, current.input),
          history,
          isLoadingData: false,
        };
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoadingData: false,
        loadError: getErrorMessage(error),
      }));
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rescanPlugins = useCallback(async () => {
    setState((current) => ({
      ...current,
      isLoadingData: true,
      loadError: undefined,
    }));

    try {
      const [{ commands, plugins }, history] = await Promise.all([
        window.tooldeck.rescanPlugins(),
        window.tooldeck.listCommandRuns(25),
      ]);

      setState((current) => {
        const selectedCommandId = resolveSelectedCommandId(commands, current.selectedCommandId);
        const selected = commands.find((command) => command.id === selectedCommandId);

        return {
          ...current,
          commands,
          plugins,
          selectedCommandId,
          input: createInputState(selected, current.input),
          history,
          isLoadingData: false,
        };
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoadingData: false,
        loadError: getErrorMessage(error),
      }));
    }
  }, []);

  const selectCommand = useCallback((command: DesktopCommand) => {
    setState((current) => ({
      ...current,
      selectedCommandId: command.id,
      input: createInputState(command, current.input),
      result: undefined,
      runError: undefined,
    }));
  }, []);

  const updateInput = useCallback((key: string, value: string) => {
    setState((current) => ({
      ...current,
      input: {
        ...current.input,
        [key]: value,
      },
    }));
  }, []);

  const runSelectedCommand = useCallback(async () => {
    if (
      !selectedCommand ||
      !selectedCommand.pluginEnabled ||
      state.isLoadingData ||
      state.isRunning
    ) {
      return;
    }

    setState((current) => ({
      ...current,
      isRunning: true,
      runError: undefined,
    }));

    try {
      const result = await window.tooldeck.runCommand({
        commandId: selectedCommand.id,
        input: buildCommandInput(selectedCommand, state.input),
      });
      const [commands, plugins, history] = await Promise.all([
        window.tooldeck.listCommands(),
        window.tooldeck.listPlugins(),
        window.tooldeck.listCommandRuns(25),
      ]);

      setState((current) => ({
        ...current,
        commands,
        plugins,
        result,
        history,
        isRunning: false,
      }));
    } catch (error) {
      let history = state.history;
      let commands = state.commands;
      let plugins = state.plugins;

      try {
        [commands, plugins, history] = await Promise.all([
          window.tooldeck.listCommands(),
          window.tooldeck.listPlugins(),
          window.tooldeck.listCommandRuns(25),
        ]);
      } catch {
        // Keep the existing history if refreshing failed after the run error.
      }

      setState((current) => ({
        ...current,
        commands,
        plugins,
        history,
        isRunning: false,
        runError: getErrorMessage(error),
      }));
    }
  }, [
    selectedCommand,
    state.commands,
    state.history,
    state.input,
    state.isLoadingData,
    state.isRunning,
    state.plugins,
  ]);

  const setPluginEnabled = useCallback(async (pluginId: string, enabled: boolean) => {
    setState((current) => ({
      ...current,
      isLoadingData: true,
      loadError: undefined,
    }));

    try {
      await window.tooldeck.setPluginEnabled({
        pluginId,
        enabled,
      });
      const [commands, plugins] = await Promise.all([
        window.tooldeck.listCommands(),
        window.tooldeck.listPlugins(),
      ]);

      setState((current) => ({
        ...current,
        commands,
        plugins,
        selectedCommandId: resolveSelectedCommandId(commands, current.selectedCommandId),
        isLoadingData: false,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoadingData: false,
        loadError: getErrorMessage(error),
      }));
    }
  }, []);

  return (
    <main className="bg-background text-foreground grid min-h-screen grid-cols-[280px_minmax(0,1fr)] max-lg:grid-cols-1">
      <aside className="border-border bg-muted/30 flex min-h-0 flex-col border-r max-lg:border-r-0 max-lg:border-b">
        <div className="flex h-16 items-center gap-2 px-5">
          <Braces className="text-primary size-5" />
          <span className="text-base font-semibold">Tooldeck</span>
        </div>
        <Separator />
        <div className="text-muted-foreground px-5 py-3 text-xs font-medium uppercase">
          Commands
        </div>
        <ScrollArea className="min-h-0 flex-1 px-3 pb-4">
          <CommandList
            commands={state.commands}
            isLoading={state.isLoadingData}
            loadError={state.loadError}
            selectedCommandId={state.selectedCommandId}
            onSelect={selectCommand}
          />
        </ScrollArea>
        <Separator />
        <div className="text-muted-foreground px-5 py-3 text-xs font-medium uppercase">Plugins</div>
        <ScrollArea className="max-h-72 px-3 pb-4">
          <PluginList
            plugins={state.plugins}
            isLoading={state.isLoadingData}
            onSetEnabled={setPluginEnabled}
          />
        </ScrollArea>
      </aside>

      <section className="flex min-w-0 flex-col">
        <header className="border-border flex min-h-16 items-center justify-between gap-4 border-b px-6 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">
              {selectedCommand?.title ?? (state.isLoadingData ? "Loading" : "No command")}
            </h1>
            <p className="text-muted-foreground mt-1 truncate text-sm">
              {selectedCommand?.description ?? selectedCommand?.id ?? "Trusted local plugins"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={state.isLoadingData}
              onClick={() => void rescanPlugins()}
            >
              <RefreshCw className={cn("size-4", state.isLoadingData && "animate-spin")} />
              Refresh
            </Button>
            <Button
              type="button"
              disabled={
                !selectedCommand ||
                !selectedCommand.pluginEnabled ||
                state.isLoadingData ||
                state.isRunning
              }
              onClick={() => void runSelectedCommand()}
            >
              {state.isRunning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Run
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
          {state.loadError ? <ErrorNotice message={state.loadError} title="Load failed" /> : null}

          <div className="grid min-h-90 flex-1 grid-cols-2 gap-4 max-xl:grid-cols-1">
            <section className="border-border bg-card flex min-w-0 flex-col rounded-lg border">
              <PanelHeader
                title="Input"
                trailing={
                  selectedCommand ? (
                    <div className="flex items-center gap-2">
                      <StatusBadge status={selectedCommand.pluginRuntimeState} />
                      <span>{selectedCommand.id}</span>
                    </div>
                  ) : undefined
                }
              />
              <CommandInputForm
                command={selectedCommand}
                input={state.input}
                onChange={updateInput}
              />
            </section>

            <section className="border-border bg-card flex min-w-0 flex-col rounded-lg border">
              <PanelHeader
                title="Output"
                trailing={<StatusBadge status={state.result?.status ?? "idle"} />}
              />
              {state.runError ? (
                <ErrorNotice message={state.runError} title="Run failed" compact />
              ) : null}
              <CommandOutput result={state.result} hasError={Boolean(state.runError)} />
            </section>
          </div>

          <section className="border-border bg-card rounded-lg border">
            <PanelHeader
              icon={<History className="text-muted-foreground size-4" />}
              title="Command History"
              trailing={`${state.history.length} runs`}
            />
            <CommandHistory history={state.history} isLoading={state.isLoadingData} />
          </section>
        </div>
      </section>
    </main>
  );
}

function CommandList({
  commands,
  isLoading,
  loadError,
  selectedCommandId,
  onSelect,
}: {
  commands: DesktopCommand[];
  isLoading: boolean;
  loadError?: string;
  selectedCommandId?: string;
  onSelect(command: DesktopCommand): void;
}) {
  if (commands.length === 0) {
    return (
      <EmptyState
        text={
          isLoading ? "Loading commands" : loadError ? "Unable to load commands" : "No commands"
        }
      />
    );
  }

  return (
    <div className="grid gap-1.5">
      {commands.map((command) => (
        <button
          key={command.id}
          type="button"
          className={cn(
            "grid min-h-16 gap-1 rounded-md border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted",
            command.id === selectedCommandId && "border-border bg-background shadow-xs",
            !command.pluginEnabled && "opacity-55",
          )}
          onClick={() => onSelect(command)}
        >
          <span className="flex min-w-0 items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{command.title}</span>
            {!command.pluginEnabled ? <Badge variant="outline">Disabled</Badge> : null}
          </span>
          <span className="text-muted-foreground truncate text-xs">
            {command.id} · {command.pluginRuntimeState}
          </span>
        </button>
      ))}
    </div>
  );
}

function PluginList({
  plugins,
  isLoading,
  onSetEnabled,
}: {
  plugins: DesktopPlugin[];
  isLoading: boolean;
  onSetEnabled(pluginId: string, enabled: boolean): void;
}) {
  if (plugins.length === 0) {
    return <EmptyState text={isLoading ? "Loading plugins" : "No plugins"} />;
  }

  return (
    <div className="grid gap-1.5">
      {plugins.map((plugin) => (
        <div
          key={plugin.id}
          className={cn(
            "border-border bg-background grid gap-2 rounded-md border px-3 py-2.5",
            !plugin.enabled && "opacity-65",
          )}
        >
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{plugin.name}</div>
              <div className="text-muted-foreground truncate text-xs">{plugin.id}</div>
            </div>
            <Button
              type="button"
              variant={plugin.enabled ? "secondary" : "outline"}
              size="icon-sm"
              disabled={isLoading}
              aria-label={plugin.enabled ? `Disable ${plugin.name}` : `Enable ${plugin.name}`}
              onClick={() => onSetEnabled(plugin.id, !plugin.enabled)}
            >
              <Power className="size-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <StatusBadge status={plugin.enabled ? plugin.runtimeState : "disabled"} />
            <span className="text-muted-foreground text-xs">{plugin.commandCount} commands</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommandInputForm({
  command,
  input,
  onChange,
}: {
  command?: DesktopCommand;
  input: Record<string, string>;
  onChange(key: string, value: string): void;
}) {
  const fields = getInputFields(command);

  if (!command) {
    return <EmptyState text="No command selected" className="flex-1 p-4" />;
  }

  if (fields.length === 0) {
    return <EmptyState text="No input" className="flex-1 p-4" />;
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="grid gap-4 p-4">
        {fields.map((field) => (
          <div key={field.key} className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`command-input-${field.key}`}>{field.title}</Label>
              {field.required ? <Badge variant="outline">Required</Badge> : null}
            </div>
            {field.kind === "textarea" ? (
              <Textarea
                id={`command-input-${field.key}`}
                spellCheck={false}
                value={input[field.key] ?? ""}
                className="min-h-60 resize-none font-mono text-sm"
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            ) : (
              <Input
                id={`command-input-${field.key}`}
                type={field.kind === "number" ? "number" : "text"}
                min={field.minimum}
                max={field.maximum}
                value={input[field.key] ?? ""}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            )}
            {field.description ? (
              <p className="text-muted-foreground text-xs">{field.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function CommandOutput({ result, hasError }: { result?: CommandResult; hasError: boolean }) {
  if (!result) {
    return <EmptyState text={hasError ? "Error" : "No output"} className="flex-1 p-4" />;
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="grid gap-3 p-4">
        {result.blocks.map((block, index) => (
          <pre
            key={`${block.type}-${index}`}
            className="bg-muted min-h-0 overflow-auto rounded-md p-3 font-mono text-sm leading-6 whitespace-pre-wrap"
          >
            {block.text}
          </pre>
        ))}
      </div>
    </ScrollArea>
  );
}

function CommandHistory({
  history,
  isLoading,
}: {
  history: CommandRunRecord[];
  isLoading: boolean;
}) {
  if (history.length === 0) {
    return <EmptyState text={isLoading ? "Loading history" : "No command runs"} className="p-4" />;
  }

  return (
    <div className="divide-border divide-y">
      {history.map((run) => (
        <div
          key={run.id}
          className="grid grid-cols-[minmax(0,1fr)_84px_86px] items-center gap-3 px-4 py-3 max-md:grid-cols-1"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{run.commandId}</div>
            <div className="text-muted-foreground truncate text-xs">
              {new Date(run.createdAt).toLocaleString()} · {run.source}
            </div>
          </div>
          <StatusBadge status={run.status} />
          <span className="text-muted-foreground text-right text-xs max-md:text-left">
            {run.durationMs ?? 0} ms
          </span>
        </div>
      ))}
    </div>
  );
}

function PanelHeader({
  icon,
  title,
  trailing,
}: {
  icon?: React.ReactNode;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="border-border flex min-h-12 items-center justify-between gap-3 border-b px-4">
      <div className="flex min-w-0 items-center gap-2">
        {icon}
        <h2 className="truncate text-sm font-medium">{title}</h2>
      </div>
      {trailing ? (
        <div className="text-muted-foreground shrink-0 truncate text-xs">{trailing}</div>
      ) : null}
    </div>
  );
}

type StatusBadgeStatus =
  | CommandResult["status"]
  | "idle"
  | "inactive"
  | "activating"
  | "active"
  | "deactivating"
  | "failed"
  | "disposed"
  | "disabled";

function StatusBadge({ status }: { status: StatusBadgeStatus }) {
  const variant =
    status === "error" || status === "failed"
      ? "destructive"
      : status === "success" || status === "active"
        ? "secondary"
        : "outline";

  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}

function ErrorNotice({
  title,
  message,
  compact = false,
}: {
  title: string;
  message: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 text-destructive",
        compact ? "mx-4 mt-4 px-3 py-2 text-sm" : "px-4 py-3",
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <div className="font-medium">{title}</div>
        <div className="overflow-wrap-anywhere text-sm">{message}</div>
      </div>
    </div>
  );
}

function EmptyState({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-24 items-center justify-center text-sm text-muted-foreground",
        className,
      )}
    >
      {text}
    </div>
  );
}

interface InputField {
  key: string;
  title: string;
  description?: string;
  kind: "text" | "textarea" | "number";
  required: boolean;
  defaultValue?: unknown;
  minimum?: number;
  maximum?: number;
}

function getInputFields(command: DesktopCommand | undefined): InputField[] {
  const schema = command?.inputSchema;

  if (!isObjectSchema(schema)) {
    return [];
  }

  const required = Array.isArray(schema.required) ? schema.required : [];
  const properties = isRecord(schema.properties) ? schema.properties : {};

  return Object.entries(properties).map(([key, value]) => {
    const fieldSchema = isRecord(value) ? value : {};
    const type = typeof fieldSchema.type === "string" ? fieldSchema.type : "string";
    const title = typeof fieldSchema.title === "string" ? fieldSchema.title : key;
    const description =
      typeof fieldSchema.description === "string" ? fieldSchema.description : undefined;

    return {
      key,
      title,
      description,
      kind:
        type === "integer" || type === "number"
          ? "number"
          : type === "string"
            ? "textarea"
            : "text",
      required: required.includes(key),
      defaultValue: fieldSchema.default,
      minimum: typeof fieldSchema.minimum === "number" ? fieldSchema.minimum : undefined,
      maximum: typeof fieldSchema.maximum === "number" ? fieldSchema.maximum : undefined,
    };
  });
}

function createInputState(
  command: DesktopCommand | undefined,
  currentInput: Record<string, string>,
): Record<string, string> {
  const fields = getInputFields(command);

  return Object.fromEntries(
    fields.map((field) => [field.key, currentInput[field.key] ?? defaultInputValue(field)]),
  );
}

function defaultInputValue(field: InputField): string {
  if (field.defaultValue !== undefined) {
    return String(field.defaultValue);
  }

  if (field.key === "text") {
    return '{"a":1}';
  }

  return "";
}

function buildCommandInput(command: DesktopCommand, input: Record<string, string>): JsonObject {
  const fields = getInputFields(command);
  const entries = fields.map<[string, unknown]>((field) => {
    const value = input[field.key] ?? "";

    if (field.kind === "number") {
      return [field.key, Number(value)];
    }

    return [field.key, value];
  });

  return Object.fromEntries(entries) as JsonObject;
}

function resolveSelectedCommandId(
  commands: DesktopCommand[],
  selectedCommandId: string | undefined,
): string | undefined {
  if (selectedCommandId && commands.some((command) => command.id === selectedCommandId)) {
    return selectedCommandId;
  }

  return commands[0]?.id;
}

function isObjectSchema(schema: TooldeckJsonSchema | undefined): schema is TooldeckJsonSchema & {
  properties?: unknown;
  required?: unknown;
} {
  return isRecord(schema) && schema.type === "object";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
