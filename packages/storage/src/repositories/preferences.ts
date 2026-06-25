import type { PreferenceScope } from "@tooldeck/preferences";
import { and, asc, eq } from "drizzle-orm";

import type { TooldeckDrizzleDatabase } from "../database";
import { preferences, type PreferenceRow } from "../schema";

export type { PreferenceScope };

export interface SetPreferenceInput {
  scope: PreferenceScope;
  key: string;
  value: unknown;
  now?: number;
}

export class PreferenceRepository {
  constructor(private readonly db: TooldeckDrizzleDatabase) {}

  get(scope: PreferenceScope, key: string): unknown {
    const row = this.getRow(scope, key);

    if (!row) {
      return undefined;
    }

    return JSON.parse(row.valueJson);
  }

  getRow(scope: PreferenceScope, key: string): PreferenceRow | undefined {
    return this.db
      .select()
      .from(preferences)
      .where(and(eq(preferences.scope, scope), eq(preferences.key, key)))
      .get();
  }

  list(scope: PreferenceScope): PreferenceRow[] {
    return this.db
      .select()
      .from(preferences)
      .where(eq(preferences.scope, scope))
      .orderBy(asc(preferences.key))
      .all();
  }

  set(input: SetPreferenceInput): PreferenceRow {
    const valueJson = stringifyPreferenceValue(input.value);
    const now = input.now ?? Date.now();

    this.db
      .insert(preferences)
      .values({
        scope: input.scope,
        key: input.key,
        valueJson,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [preferences.scope, preferences.key],
        set: {
          valueJson,
          updatedAt: now,
        },
      })
      .run();

    return this.getRow(input.scope, input.key)!;
  }

  delete(scope: PreferenceScope, key: string): void {
    this.db
      .delete(preferences)
      .where(and(eq(preferences.scope, scope), eq(preferences.key, key)))
      .run();
  }
}

function stringifyPreferenceValue(value: unknown): string {
  const valueJson = JSON.stringify(value);

  if (valueJson === undefined) {
    throw new TypeError("Preference value must be JSON serializable");
  }

  return valueJson;
}
