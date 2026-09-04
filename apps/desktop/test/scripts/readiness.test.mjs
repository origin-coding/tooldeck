import assert from "node:assert/strict";
import { getEventListeners, once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { waitForFile, waitForHttp } from "../../scripts/readiness.mjs";

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tooldeck-readiness-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function serve(t, handler) {
  const server = http.createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test(
  "file readiness waits for creation and releases the caller's abort listener",
  { timeout: 5_000 },
  async (t) => {
    const file = path.join(await temporaryDirectory(t), "main.js");
    const controller = new AbortController();
    const ready = waitForFile(file, { intervalMs: 5, timeoutMs: 1_000, signal: controller.signal });
    await writeFile(file, "export {};");
    await ready;
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  },
);

test("file readiness rejects directories instead of polling them", async (t) => {
  const directory = await temporaryDirectory(t);
  await assert.rejects(waitForFile(directory), /Expected a file/);
});

test("file readiness propagates unexpected filesystem errors", async () => {
  await assert.rejects(waitForFile("\0"), (error) => error.code === "ERR_INVALID_ARG_VALUE");
});

for (const outcome of ["timeout", "cancel", "already-cancelled"]) {
  test(`file readiness cleans up after ${outcome}`, { timeout: 5_000 }, async (t) => {
    const file = path.join(await temporaryDirectory(t), "missing");
    const controller = new AbortController();
    const reason = new Error("cancelled by test");
    if (outcome === "already-cancelled") controller.abort(reason);
    const waiting = waitForFile(file, { timeoutMs: 30, intervalMs: 5, signal: controller.signal });
    const assertion = assert.rejects(waiting, (error) =>
      outcome === "timeout" ? error.name === "TimeoutError" : error === reason,
    );
    if (outcome === "cancel") controller.abort(reason);
    await assertion;
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  });
}

for (const status of [200, 404, 503]) {
  test(`HTTP readiness handles initial status ${status}`, { timeout: 5_000 }, async (t) => {
    let requests = 0;
    const url = await serve(t, (_request, response) => {
      response.writeHead(++requests === 1 ? status : 200);
      response.end();
    });
    const controller = new AbortController();
    await waitForHttp(url, { timeoutMs: 1_000, intervalMs: 5, signal: controller.signal });
    assert.equal(requests, status === 200 ? 1 : 2);
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  });
}

test("HTTP readiness fails fast on authorization errors", { timeout: 5_000 }, async (t) => {
  let requests = 0;
  const url = await serve(t, (_request, response) => {
    requests++;
    response.writeHead(403).end();
  });
  const controller = new AbortController();
  await assert.rejects(
    waitForHttp(url, { signal: controller.signal }),
    /Unexpected HTTP status 403/,
  );
  assert.equal(requests, 1);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

test("HTTP readiness rejects unsupported protocols", async () => {
  await assert.rejects(waitForHttp("file:///example"), /Unsupported readiness protocol/);
});

test(
  "HTTP readiness tolerates connection refusal until the server starts",
  { timeout: 5_000 },
  async (t) => {
    const server = http.createServer((_request, response) => response.end("ready"));
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = server.address().port;
    await new Promise((resolve) => server.close(resolve));
    const controller = new AbortController();
    let timer;
    t.after(async () => {
      clearTimeout(timer);
      controller.abort();
      server.closeAllConnections();
      if (server.listening) await new Promise((resolve) => server.close(resolve));
    });
    const waiting = waitForHttp(`http://127.0.0.1:${port}`, {
      timeoutMs: 2_000,
      intervalMs: 5,
      signal: controller.signal,
    });
    timer = setTimeout(() => server.listen(port, "127.0.0.1"), 50);
    await waiting;
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  },
);

for (const outcome of ["timeout", "cancel"]) {
  test(
    `HTTP readiness interrupts a stalled request on ${outcome}`,
    { timeout: 5_000 },
    async (t) => {
      let onRequest;
      const received = new Promise((resolve) => {
        onRequest = resolve;
      });
      const url = await serve(t, (request) => onRequest(request));
      const controller = new AbortController();
      const reason = new Error("stop HTTP readiness");
      const waiting = waitForHttp(url, { timeoutMs: 200, signal: controller.signal });
      const assertion = assert.rejects(waiting, (error) =>
        outcome === "timeout" ? error.name === "TimeoutError" : error === reason,
      );
      await received;
      if (outcome === "cancel") controller.abort(reason);
      await assertion;
      assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    },
  );
}
