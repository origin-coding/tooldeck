import Ajv from "ajv";

/** @internal */
export function createProfileAjv(): Ajv {
  return createAjv({ coerceTypes: false, useDefaults: false });
}

/** @internal */
export function createInputAjv(coerceTypes: boolean): Ajv {
  const ajv = createAjv({ coerceTypes, useDefaults: true });

  addAnnotationKeyword(ajv, "x-i18n", "object");
  addAnnotationKeyword(ajv, "x-ui", "object");
  addAnnotationKeyword(ajv, "x-enumLabels", "object");

  return ajv;
}

/** @internal */
export function createOutputAjv(): Ajv {
  return createAjv({ coerceTypes: false, useDefaults: false });
}

/** @internal */
export function createStaticDraft07Ajv(): Ajv {
  return createAjv({ coerceTypes: false, useDefaults: false });
}

function createAjv(options: { coerceTypes: boolean; useDefaults: boolean }): Ajv {
  return new Ajv({
    allErrors: true,
    coerceTypes: options.coerceTypes,
    logger: false,
    ownProperties: true,
    removeAdditional: false,
    strictNumbers: true,
    strictRequired: false,
    strictSchema: true,
    strictTuples: false,
    strictTypes: false,
    useDefaults: options.useDefaults,
    validateSchema: true,
    verbose: true,
  });
}

function addAnnotationKeyword(ajv: Ajv, keyword: string, schemaType: "boolean" | "object"): void {
  if (ajv.getKeyword(keyword)) {
    return;
  }

  ajv.addKeyword({
    keyword,
    schemaType,
    valid: true,
    errors: false,
  });
}
