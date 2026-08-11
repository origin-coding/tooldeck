import type { Commands } from "@/commands/context";
import type { History } from "@/history/context";
import type { Plugins } from "@/plugins/context";
import type { Preferences } from "@/preferences/context";

export type ApplicationServices = Commands | Plugins | Preferences | History;
