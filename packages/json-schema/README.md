# @tooldeck/json-schema

`@tooldeck/json-schema` is Tooldeck's public, Effect-neutral JSON Schema Draft-07 execution
package. It sits between the data-only schemas in `@tooldeck/protocol` and the
owner-specific adapters in runtime, plugin tooling, and package handling.

The public boundary exposes Tooldeck-owned compilation results, validators, validation
results, and JSON-safe issues. It does not expose Ajv instances, option bags,
`ErrorObject`, or `ValidateFunction`.

The package owns:

- fixed Draft-07 engine configuration;
- registration of Tooldeck's manifest, command-input-v1, and command-output-v1 roles;
- strict command input, CLI command input, and command output compilation;
- JSON-safe copying before defaults or CLI coercion;
- stable Ajv-independent issue normalization.

It does not own runtime caches or disposal, `RuntimeError`, plugin author suggestions,
`.tdplugin` package errors, Effect adapters, remote schemas, formats, or custom executable
keywords.

## Usage

Create one engine for the caller-owned lifecycle, compile a Schema once, and reuse the
opaque validator:

```ts
import { createTooldeckJsonSchemaEngine } from "@tooldeck/json-schema";

const engine = createTooldeckJsonSchemaEngine();
const compilation = engine.compileCommandInput(inputSchema, "cli");

if (!compilation.compiled) {
  return handleSchemaError(compilation.error);
}

const result = compilation.validator.validate(rawInput);

if (!result.valid) {
  return handleInputError(result.error);
}

return result.value;
```

Compilation and validation failures return a whole JSON-safe error object with a stable
`kind`, `code`, `message`, and complete `issues` array. Consumers should present the
whole error rather than choosing a single issue as the authoritative failure. Each issue
has a stable Tooldeck-owned code, instance and Schema property paths, and optional
structured facts such as `parameters.property` or `parameters.limit`.

Adapters can add owner-specific path context without rewriting or selecting issues:

```ts
import { prefixJsonSchemaError } from "@tooldeck/json-schema";

if (!compilation.compiled) {
  const contextualError = prefixJsonSchemaError(compilation.error, {
    instancePath: "/contributes/commands/0/inputSchema",
    propertyPath: "contributes.commands[0].inputSchema",
  });

  return handleManifestSchemaError(contextualError);
}
```

Strict and CLI input validation both apply defaults to a JSON-safe copy. CLI validation
also enables type coercion; strict validation does not. Neither mode mutates caller-owned
values. Command output validation applies neither defaults nor coercion. If a command has
no optional `outputSchema`, consumers do not compile an output validator.

`compileManifest()` always uses the canonical manifest and command profile schemas from
`@tooldeck/protocol`. `compileDraft07()` is the fixed, isolated entry point for other
package-owned static Draft-07 schemas and does not load external references.

## Dependencies

- `@tooldeck/protocol` supplies schemas, profile identifiers, and public data types.
- `ajv` is a runtime implementation detail and must not appear in generated public
  declarations.

TypeScript, Vite, and Vitest are workspace build tools supplied by the repository root;
they are not runtime dependencies of this package.
