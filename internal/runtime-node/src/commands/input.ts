export type CommandInputCoercion = "none" | "cli";

export interface CommandInputContext {
  commandId?: string;
  coercion: CommandInputCoercion;
}
