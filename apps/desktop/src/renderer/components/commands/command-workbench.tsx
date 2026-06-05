import type { CommandResult } from "@tooldeck/protocol";
import { AlertCircle, History } from "lucide-react";

import { CommandHistory } from "@/renderer/components/commands/command-history";
import { CommandInputForm } from "@/renderer/components/commands/command-input-form";
import { CommandOutput } from "@/renderer/components/commands/command-output";
import { EmptyCard } from "@/renderer/components/common/empty-card";
import { ErrorNotice } from "@/renderer/components/common/error-notice";
import { StatusBadge } from "@/renderer/components/common/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/renderer/components/ui/alert";
import { Badge } from "@/renderer/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/renderer/components/ui/card";
import type { CommandRunRecord, DesktopCommand, DesktopPlugin } from "@/shared/desktop-api";

export function CommandWorkbench({
  command,
  plugin,
  history,
  input,
  isLoading,
  result,
  runError,
  onChangeInput,
}: {
  command?: DesktopCommand;
  plugin?: DesktopPlugin;
  history: CommandRunRecord[];
  input: Record<string, string>;
  isLoading: boolean;
  result?: CommandResult;
  runError?: string;
  onChangeInput(key: string, value: string): void;
}) {
  if (!command) {
    return (
      <EmptyCard
        title="No command selected"
        text={isLoading ? "Loading commands" : "Choose a command from the list."}
      />
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{command.title}</CardTitle>
          <CardDescription>{command.description ?? command.id}</CardDescription>
          <CardAction className="flex items-center gap-2">
            <StatusBadge status={command.pluginEnabled ? command.pluginRuntimeState : "disabled"} />
            {plugin ? <Badge variant="outline">{plugin.name}</Badge> : null}
          </CardAction>
        </CardHeader>
        {!command.pluginEnabled ? (
          <CardContent>
            <Alert>
              <AlertCircle className="size-4" />
              <AlertTitle>Plugin disabled</AlertTitle>
              <AlertDescription>
                Enable {plugin?.name ?? command.pluginId} before running this command.
              </AlertDescription>
            </Alert>
          </CardContent>
        ) : null}
      </Card>

      <div className="grid min-h-96 grid-cols-2 gap-5 max-xl:grid-cols-1">
        <Card className="min-h-0">
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>{command.id}</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            <CommandInputForm command={command} input={input} onChange={onChangeInput} />
          </CardContent>
        </Card>

        <Card className="min-h-0">
          <CardHeader>
            <CardTitle>Output</CardTitle>
            <CardAction>
              <StatusBadge status={result?.status ?? "idle"} />
            </CardAction>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            {runError ? <ErrorNotice message={runError} title="Run failed" compact /> : null}
            <CommandOutput result={result} hasError={Boolean(runError)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="text-muted-foreground size-4" />
            Command History
          </CardTitle>
          <CardDescription>{history.length} recent runs</CardDescription>
        </CardHeader>
        <CardContent>
          <CommandHistory history={history} isLoading={isLoading} />
        </CardContent>
      </Card>
    </>
  );
}
