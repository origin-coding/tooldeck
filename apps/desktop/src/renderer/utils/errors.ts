import { isDesktopApiError } from "@/shared/api";

export function getErrorMessage(error: unknown): string {
  if (isDesktopApiError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
