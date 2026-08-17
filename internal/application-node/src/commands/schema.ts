import { Schema } from "effect";

import type { ListApplicationCommandsRequest } from "@/commands/types";
import { JsonObjectSchema, NonEmptyStringSchema } from "@/validation/schemas";

export const ListApplicationCommandsRequestSchema = Schema.Struct({
  locale: Schema.optional(Schema.String),
}) satisfies Schema.Schema<ListApplicationCommandsRequest>;

export const RunApplicationCommandRequestSchema = Schema.Struct({
  commandId: NonEmptyStringSchema,
  input: Schema.optional(JsonObjectSchema),
  locale: Schema.optional(Schema.String),
  source: Schema.optional(Schema.String),
  recordHistory: Schema.optional(Schema.Boolean),
});
