export type TooldeckPackageErrorCode =
  | "INVALID_PACKAGE_EXTENSION"
  | "PACKAGE_READ_FAILED"
  | "PACKAGE_WRITE_FAILED"
  | "PACKAGE_EXTRACT_FAILED"
  | "PACKAGE_TOO_LARGE"
  | "TOO_MANY_FILES"
  | "UNCOMPRESSED_SIZE_TOO_LARGE"
  | "INVALID_ZIP"
  | "UNSUPPORTED_ENCRYPTED_ZIP"
  | "UNSUPPORTED_ZIP64"
  | "UNSUPPORTED_ZIP_ENTRY"
  | "MISSING_PACKAGE_MANIFEST"
  | "MISSING_PLUGIN_MANIFEST"
  | "MISSING_RUNTIME_ENTRY"
  | "UNSUPPORTED_RUNTIME_KIND"
  | "INVALID_PACKAGE_METADATA"
  | "INVALID_PACKAGE_MANIFEST"
  | "INVALID_PLUGIN_MANIFEST"
  | "INVALID_PACKAGE_PATH"
  | "NODE_MODULES_NOT_ALLOWED"
  | "DUPLICATE_FILE_LIST_ENTRY"
  | "UNSORTED_FILE_LIST"
  | "FILE_LIST_MISMATCH"
  | "EXTRACTION_ESCAPE";

export interface TooldeckPackageErrorContext {
  packagePath?: string;
  entryPath?: string;
  manifestPath?: string;
  fieldPath?: string;
  reason?: string;
}

export class TooldeckPackageError extends Error {
  readonly code: TooldeckPackageErrorCode;
  readonly context: TooldeckPackageErrorContext;

  constructor(
    code: TooldeckPackageErrorCode,
    message: string,
    context: TooldeckPackageErrorContext = {},
  ) {
    super(message);
    this.name = "TooldeckPackageError";
    this.code = code;
    this.context = context;
  }
}

export function packageError(
  code: TooldeckPackageErrorCode,
  message: string,
  context: TooldeckPackageErrorContext = {},
): TooldeckPackageError {
  return new TooldeckPackageError(code, message, context);
}
