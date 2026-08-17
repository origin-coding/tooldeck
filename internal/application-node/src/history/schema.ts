import type { LocalizedString } from "@tooldeck/protocol";
import { Schema } from "effect";

import type { ListApplicationCommandRunsRequest } from "@/history/types";
import {
  JsonObjectSchema,
  JsonValueSchema,
  NonEmptyStringSchema,
  PositiveSafeIntegerSchema,
} from "@/validation/schemas";

export const ListApplicationCommandRunsRequestSchema = Schema.Struct({
  limit: Schema.optional(PositiveSafeIntegerSchema),
  commandId: Schema.optional(NonEmptyStringSchema),
}) satisfies Schema.Schema<ListApplicationCommandRunsRequest>;

export const CommandStatusSchema = Schema.Literal("success", "error");

const LocalizedStringSchema = Schema.Union(
  Schema.String,
  Schema.mutable(
    Schema.Struct({
      key: Schema.String,
      default: Schema.String,
    }),
  ),
) satisfies Schema.Schema<LocalizedString>;

const TextContentBlockSchema = Schema.mutable(
  Schema.Struct({
    type: Schema.Literal("text"),
    text: Schema.String,
  }),
);

const CodeContentBlockSchema = Schema.mutable(
  Schema.Struct({
    type: Schema.Literal("code"),
    text: Schema.String,
    language: Schema.optional(Schema.String),
  }),
);

const JsonContentBlockSchema = Schema.mutable(
  Schema.Struct({
    type: Schema.Literal("json"),
    value: JsonValueSchema,
  }),
);

const PropertyValueSchema = Schema.Union(
  Schema.String,
  Schema.Number.pipe(Schema.finite()),
  Schema.Boolean,
  Schema.Null,
);

const PropertiesContentBlockSchema = Schema.mutable(
  Schema.Struct({
    type: Schema.Literal("properties"),
    items: Schema.mutable(
      Schema.Array(
        Schema.mutable(
          Schema.Struct({
            label: LocalizedStringSchema,
            value: PropertyValueSchema,
            note: Schema.optional(LocalizedStringSchema),
          }),
        ),
      ),
    ),
  }),
);

const ContentBlockSchema = Schema.Union(
  TextContentBlockSchema,
  CodeContentBlockSchema,
  JsonContentBlockSchema,
  PropertiesContentBlockSchema,
);

export const CommandResultSchema = Schema.mutable(
  Schema.Struct({
    status: CommandStatusSchema,
    blocks: Schema.mutable(Schema.Array(ContentBlockSchema)),
    error: Schema.optional(
      Schema.mutable(
        Schema.Struct({
          message: Schema.String,
          code: Schema.optional(Schema.String),
          metadata: Schema.optional(JsonObjectSchema),
        }),
      ),
    ),
  }),
);
