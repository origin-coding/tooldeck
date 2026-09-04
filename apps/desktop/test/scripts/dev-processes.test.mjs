import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { createProcessSupervisor } from "../../scripts/dev-processes.mjs";

function setup(t, options = {}) {
  const supervisor = createProcessSupervisor(options);
  t.after(() => supervisor.shutdown());
  return supervisor;
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

test(
  "preparation preserves environment, exit status, and prefixed line output",
  { timeout: 10_000 },
  async (t) => {
    const lines = [];
    const supervisor = setup(t, { log: (name, line) => lines.push([name, line]) });
    const child = supervisor.start(
      "builtin-plugins",
      process.execPath,
      [
        "-e",
        `
    process.stdout.write(process.env.TOOLDECK_TEST_VALUE + '\\npartial');
    process.stderr.write('diagnostic\\n');
  `,
      ],
      { required: false, env: { ...process.env, TOOLDECK_TEST_VALUE: "explicit" } },
    );
    assert.equal((await child.completed).code, 0);
    await child.closed;
    assert.equal(supervisor.signal.aborted, false);
    assert.deepEqual(
      lines.filter(([, line]) => line !== "diagnostic"),
      [
        ["builtin-plugins", "explicit"],
        ["builtin-plugins", "partial"],
      ],
    );
    assert.ok(lines.some(([name, line]) => name === "builtin-plugins" && line === "diagnostic"));
  },
);

for (const code of [0, 7]) {
  test(
    `required child exit ${code} cancels the session and terminates its peer`,
    { timeout: 10_000 },
    async (t) => {
      const supervisor = setup(t);
      const peer = supervisor.start("renderer", process.execPath, [
        "-e",
        "setInterval(() => {}, 1000)",
      ]);
      supervisor.start("main", process.execPath, ["-e", `process.exit(${code})`]);
      await once(supervisor.signal, "abort");
      await supervisor.shutdown();
      assert.match(supervisor.signal.reason.message, /main exited unexpectedly/);
      assert.equal(isAlive(peer.child.pid), false);
      assert.throws(
        () => supervisor.start("late", process.execPath, []),
        /main exited unexpectedly/,
      );
    },
  );
}

test(
  "spawn failure cancels the session and preserves its diagnostic",
  { timeout: 10_000 },
  async (t) => {
    const supervisor = setup(t);
    supervisor.start("missing", process.execPath + ".tooldeck-missing", []);
    await once(supervisor.signal, "abort");
    await supervisor.shutdown();
    assert.match(supervisor.signal.reason.message, /missing failed to start/);
  },
);

test("cancelling preparation terminates its owned descendant", { timeout: 10_000 }, async (t) => {
  let markReady;
  const ready = new Promise((resolve) => {
    markReady = resolve;
  });
  const supervisor = setup(t, {
    log: (_name, line) => {
      if (line.startsWith("descendant:")) markReady(Number(line.slice(11)));
    },
  });
  const preparation = supervisor.start(
    "builtin-plugins",
    process.execPath,
    [
      "-e",
      `
    const { spawn } = require('node:child_process');
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    child.once('spawn', () => console.log('descendant:' + child.pid));
    setInterval(() => {}, 1000);
  `,
    ],
    { required: false },
  );
  const descendant = await ready;
  const reason = new Error("received SIGINT");
  supervisor.abort(reason);
  await supervisor.shutdown();
  assert.equal(supervisor.signal.reason, reason);
  assert.equal(isAlive(preparation.child.pid), false);
  assert.equal(isAlive(descendant), false);
});

test(
  "shutdown is repeatable and closes a running optional child",
  { timeout: 10_000 },
  async (t) => {
    const supervisor = setup(t);
    const electron = supervisor.start(
      "electron",
      process.execPath,
      ["-e", "setInterval(() => {}, 1000)"],
      {
        required: false,
      },
    );
    await once(electron.child, "spawn");
    await supervisor.shutdown();
    await supervisor.shutdown();
    assert.equal(isAlive(electron.child.pid), false);
  },
);

test(
  "POSIX shutdown escalates when a child ignores SIGTERM",
  {
    timeout: 10_000,
    skip: process.platform === "win32",
  },
  async (t) => {
    let markReady;
    const ready = new Promise((resolve) => {
      markReady = resolve;
    });
    const supervisor = setup(t, {
      graceMs: 200,
      log: (_name, line) => {
        if (line === "ready") markReady();
      },
    });
    const child = supervisor.start("renderer", process.execPath, [
      "-e",
      `
    process.on('SIGTERM', () => {});
    console.log('ready');
    setInterval(() => {}, 1000);
  `,
    ]);
    await ready;
    await supervisor.shutdown();
    assert.equal((await child.completed).signal, "SIGKILL");
    assert.equal(isAlive(child.child.pid), false);
  },
);
