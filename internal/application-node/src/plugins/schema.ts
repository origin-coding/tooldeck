import { Schema } from "effect";

import type { ApplicationPluginLocaleRequest } from "@/plugins/types";
import { AbsolutePathSchema, NonEmptyStringSchema } from "@/validation/schemas";

export const ApplicationPluginLocaleRequestSchema = Schema.Struct({
  locale: Schema.optional(Schema.String),
}) satisfies Schema.Schema<ApplicationPluginLocaleRequest>;

export const SetApplicationPluginEnabledRequestSchema = Schema.Struct({
  pluginId: NonEmptyStringSchema,
  enabled: Schema.Boolean,
  locale: Schema.optional(Schema.String),
});

export const InstallApplicationPluginPackageRequestSchema = Schema.Struct({
  packagePath: AbsolutePathSchema,
  locale: Schema.optional(Schema.String),
});

export const UninstallApplicationPluginRequestSchema = Schema.Struct({
  pluginId: NonEmptyStringSchema,
  locale: Schema.optional(Schema.String),
});

export const PurgeApplicationPluginDataRequestSchema = Schema.Struct({
  pluginId: NonEmptyStringSchema,
});
