import { toApplicationError } from "@/errors/application-error";

export async function runApplicationOperation<T>(operation: () => T | Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toApplicationError(error);
  }
}
