import { Empty, Input, Modal, Segmented, Tag, Typography } from "antd";
import Fuse from "fuse.js";
import { Boxes, Search, Wrench } from "lucide-react";
import { useMemo, useState } from "react";

import type { DesktopCommand, DesktopPlugin } from "@/shared/desktop-api";

type SearchScope = "all" | "commands" | "plugins";

type SearchRecord =
  | {
      kind: "command";
      id: string;
      title: string;
      description?: string;
      pluginId: string;
      pluginName?: string;
      searchText: string[];
      command: DesktopCommand;
    }
  | {
      kind: "plugin";
      id: string;
      title: string;
      description?: string;
      searchText: string[];
      plugin: DesktopPlugin;
    };

export function SearchDialog({
  open,
  commands,
  plugins,
  onClose,
  onSelectCommand,
  onSelectPlugin,
}: {
  open: boolean;
  commands: DesktopCommand[];
  plugins: DesktopPlugin[];
  onClose(): void;
  onSelectCommand(command: DesktopCommand): void;
  onSelectPlugin(plugin: DesktopPlugin): void;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const pluginNames = useMemo(
    () => new Map(plugins.map((plugin) => [plugin.id, plugin.name])),
    [plugins],
  );
  const records = useMemo<SearchRecord[]>(
    () => [
      ...commands.map((command) => ({
        kind: "command" as const,
        id: command.id,
        title: command.title,
        description: command.description,
        pluginId: command.pluginId,
        pluginName: pluginNames.get(command.pluginId),
        searchText: command.searchText,
        command,
      })),
      ...plugins.map((plugin) => ({
        kind: "plugin" as const,
        id: plugin.id,
        title: plugin.name,
        description: plugin.description,
        searchText: plugin.searchText,
        plugin,
      })),
    ],
    [commands, pluginNames, plugins],
  );
  const scopedRecords = useMemo(
    () => records.filter((record) => isRecordInScope(record, scope)),
    [records, scope],
  );
  const fuse = useMemo(
    () =>
      new Fuse(scopedRecords, {
        keys: [
          { name: "title", weight: 4 },
          { name: "description", weight: 2 },
          { name: "id", weight: 2 },
          { name: "pluginId", weight: 1 },
          { name: "pluginName", weight: 1 },
          { name: "searchText", weight: 5 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [scopedRecords],
  );
  const trimmedQuery = query.trim();
  const results = useMemo(
    () =>
      trimmedQuery
        ? fuse.search(trimmedQuery, { limit: 40 }).map((result) => result.item)
        : scopedRecords.slice(0, 40),
    [fuse, scopedRecords, trimmedQuery],
  );

  function selectRecord(record: SearchRecord): void {
    if (record.kind === "command") {
      onSelectCommand(record.command);
    } else {
      onSelectPlugin(record.plugin);
    }

    onClose();
  }

  return (
    <Modal
      afterOpenChange={(isOpen) => {
        if (!isOpen) {
          setQuery("");
          setScope("all");
        }
      }}
      centered
      footer={null}
      open={open}
      title="Search"
      width={720}
      onCancel={onClose}
    >
      <div className="grid gap-3">
        <Input
          autoFocus
          allowClear
          size="large"
          placeholder="Search commands and plugins"
          prefix={<Search size={16} />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Segmented
          value={scope}
          options={[
            { label: "All", value: "all" },
            { label: "Commands", value: "commands" },
            { label: "Plugins", value: "plugins" },
          ]}
          onChange={(value) => setScope(value as SearchScope)}
        />

        <div className="max-h-[56vh] overflow-auto rounded-md border border-slate-200">
          {results.length === 0 ? (
            <Empty
              className="py-8"
              description="No results found"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <div className="grid divide-y divide-slate-100">
              {results.map((record) => (
                <button
                  key={`${record.kind}:${record.id}`}
                  className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 bg-white px-3 py-2.5 text-left hover:bg-blue-50"
                  type="button"
                  onClick={() => selectRecord(record)}
                >
                  <span className="flex size-8 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                    {record.kind === "command" ? <Wrench size={15} /> : <Boxes size={15} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-900">
                      {record.title}
                    </span>
                    <Typography.Text className="block min-w-0 truncate text-xs" type="secondary">
                      {record.description ?? record.id}
                    </Typography.Text>
                  </span>
                  <Tag>
                    {record.kind === "command" ? (record.pluginName ?? record.pluginId) : "Plugin"}
                  </Tag>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function isRecordInScope(record: SearchRecord, scope: SearchScope): boolean {
  if (scope === "all") {
    return true;
  }

  return scope === "commands" ? record.kind === "command" : record.kind === "plugin";
}
