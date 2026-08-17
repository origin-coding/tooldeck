import Ajv from "ajv";
import { describe, expect, it } from "vitest";

import commandInputV1Schema from "../../protocol/schema/command-input-v1.schema.json";
import commandOutputV1Schema from "../../protocol/schema/command-output-v1.schema.json";
import inputFixtures from "../../protocol/schema/fixtures/command-input-v1.fixtures.json";
import outputFixtures from "../../protocol/schema/fixtures/command-output-v1.fixtures.json";
import manifestV1Schema from "../../protocol/schema/manifest-v1.schema.json";

const inputProfileId = "https://tooldeck.dev/schemas/command-input-v1.schema.json";
const outputProfileId = "https://tooldeck.dev/schemas/command-output-v1.schema.json";

function createProfileAjv(): Ajv {
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    validateSchema: true,
  });

  ajv.addSchema(commandInputV1Schema);
  ajv.addSchema(commandOutputV1Schema);

  return ajv;
}

describe("Tooldeck command Schema profiles", () => {
  it("self-validates all three public Schema artifacts as Draft-07", () => {
    const ajv = createProfileAjv();

    expect(ajv.validateSchema(commandInputV1Schema), ajv.errorsText()).toBe(true);
    expect(ajv.validateSchema(commandOutputV1Schema), ajv.errorsText()).toBe(true);
    expect(ajv.validateSchema(manifestV1Schema), ajv.errorsText()).toBe(true);
    expect(() => ajv.compile(manifestV1Schema)).not.toThrow();
  });

  it.each(inputFixtures.valid)("accepts input fixture: $name", ({ schema }) => {
    const validate = createProfileAjv().getSchema(inputProfileId)!;

    expect(validate(schema), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it.each(inputFixtures.invalid)("rejects input fixture: $name", ({ schema }) => {
    const validate = createProfileAjv().getSchema(inputProfileId)!;

    expect(validate(schema)).toBe(false);
  });

  it.each(outputFixtures.valid)("accepts output fixture: $name", ({ schema }) => {
    const validate = createProfileAjv().getSchema(outputProfileId)!;

    expect(validate(schema), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it.each(outputFixtures.invalid)("rejects output fixture: $name", ({ schema }) => {
    const validate = createProfileAjv().getSchema(outputProfileId)!;

    expect(validate(schema)).toBe(false);
  });

  it("composes both profiles through manifest-v1 while keeping outputSchema optional", () => {
    const validate = createProfileAjv().compile(manifestV1Schema);
    const manifest = {
      schemaVersion: "1.0",
      id: "dev.example.schema-profile",
      name: "Schema profile example",
      version: "1.0.0",
      runtime: {
        kind: "node",
        entry: "./dist/index.js",
      },
      contributes: {
        commands: [
          {
            id: "example.with-output",
            title: "With output",
            inputSchema: inputFixtures.valid[0]!.schema,
            outputSchema: outputFixtures.valid[0]!.schema,
          },
          {
            id: "example.without-output",
            title: "Without output",
            inputSchema: {
              type: "object",
            },
          },
        ],
      },
    };

    expect(validate(manifest), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });
});
