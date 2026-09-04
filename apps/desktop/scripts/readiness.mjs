import { stat } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import { setTimeout as delay } from "node:timers/promises";

const retryableConnections = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "EAI_AGAIN",
]);

export function waitForFile(filePath, options = {}) {
  return poll(
    String(filePath),
    async () => {
      try {
        const info = await stat(filePath);
        if (!info.isFile()) throw new Error(`Expected a file: ${filePath}`);
        return true;
      } catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
      }
    },
    options,
  );
}

export function waitForHttp(value, options = {}) {
  return poll(
    String(value),
    (signal) => {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error(`Unsupported readiness protocol: ${url.protocol}`);
      }
      return new Promise((resolve, reject) => {
        const transport = url.protocol === "https:" ? https : http;
        const request = transport.get(url, { signal, agent: false }, (response) => {
          const status = response.statusCode;
          // Readiness only needs headers; release the body/socket immediately.
          response.destroy();
          if (status >= 200 && status < 300) resolve(true);
          else if ([404, 408, 425, 429].includes(status) || (status >= 500 && status <= 599)) {
            resolve(false);
          } else reject(new Error(`Unexpected HTTP status ${status} while waiting for ${url}`));
        });
        request.once("error", (error) => {
          if (signal.aborted) reject(signal.reason);
          else if (retryableConnections.has(error.code)) resolve(false);
          else reject(error);
        });
      });
    },
    options,
  );
}

async function poll(label, probe, { timeoutMs = 60_000, intervalMs = 100, signal } = {}) {
  for (const [name, value] of Object.entries({ timeoutMs, intervalMs })) {
    if (!Number.isFinite(value) || value <= 0 || value > 2_147_483_647) {
      throw new RangeError(`${name} must be positive and within the timer range`);
    }
  }
  signal?.throwIfAborted();
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  const timeout = setTimeout(() => {
    const error = new Error(`Timed out after ${timeoutMs}ms waiting for ${label}`);
    error.name = "TimeoutError";
    controller.abort(error);
  }, timeoutMs);
  let rejectOnAbort;
  const aborted = new Promise((_, reject) => {
    rejectOnAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener("abort", rejectOnAbort, { once: true });
  });
  try {
    await Promise.race([
      (async () => {
        for (;;) {
          controller.signal.throwIfAborted();
          const ready = await probe(controller.signal);
          controller.signal.throwIfAborted();
          if (ready) return;
          await delay(intervalMs, undefined, { signal: controller.signal });
        }
      })(),
      aborted,
    ]);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
    controller.signal.removeEventListener("abort", rejectOnAbort);
    controller.abort();
  }
}
