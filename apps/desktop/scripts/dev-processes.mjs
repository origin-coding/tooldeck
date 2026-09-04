import { spawn } from "node:child_process";

export function createProcessSupervisor({ cwd, log = () => {}, graceMs = 2_000 } = {}) {
  const controller = new AbortController();
  const children = new Set();
  let closing;

  function abort(reason) {
    controller.abort(reason);
    void shutdown().catch(() => {});
  }

  function start(
    name,
    command,
    args,
    { required = true, env = process.env, windowsHide = true } = {},
  ) {
    controller.signal.throwIfAborted();
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide,
      // pnpm/build descendants inherit this process group on POSIX.
      detached: process.platform !== "win32",
    });
    const record = { child, name, exited: false, completed: undefined, closed: undefined };
    children.add(record);
    pipeOutput(name, child.stdout, log);
    pipeOutput(name, child.stderr, log);
    record.closed = new Promise((resolve) => child.once("close", resolve));
    record.completed = new Promise((resolve) => {
      child.once("error", (error) => {
        if (!controller.signal.aborted)
          abort(new Error(`${name} failed to start: ${error.message}`));
        resolve({ code: null, signal: null });
      });
      child.once("exit", (code, signal) => {
        record.exited = true;
        if (required && !controller.signal.aborted) {
          abort(new Error(`${name} exited unexpectedly with ${signal ?? `code ${code}`}`));
        }
        resolve({ code, signal });
      });
    });
    return record;
  }

  function shutdown() {
    if (closing) return closing;
    controller.abort(new Error("Development is shutting down"));
    closing = (async () => {
      const results = await Promise.allSettled([...children].map(terminate));
      children.clear();
      const errors = results
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason);
      if (errors.length)
        throw new AggregateError(errors, errors.map((error) => error.message).join("; "));
    })();
    return closing;
  }

  async function terminate(record) {
    const { child, name } = record;
    if (!child.pid) return;
    if (process.platform === "win32") {
      if (!record.exited) await killWindowsTree(child.pid, graceMs);
    } else {
      const group = -child.pid;
      sendSignal(group, "SIGTERM");
      const deadline = Date.now() + graceMs;
      while (groupExists(group) && Date.now() < deadline) {
        await sleep(Math.min(50, Math.max(1, deadline - Date.now())));
      }
      if (groupExists(group)) sendSignal(group, "SIGKILL");
    }
    if (!(await within(record.closed, graceMs))) {
      throw new Error(`${name} did not close after process-tree termination`);
    }
  }

  return { signal: controller.signal, start, abort, shutdown };
}

function sendSignal(pid, signal) {
  try {
    process.kill(pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

function groupExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

async function killWindowsTree(pid, timeoutMs) {
  const killer = spawn("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
    stdio: "ignore",
    windowsHide: true,
  });
  const completed = new Promise((resolve, reject) => {
    killer.once("error", reject);
    killer.once("close", (code) => resolve(code));
  });
  try {
    if (!(await within(completed, timeoutMs)))
      throw new Error(`Timed out terminating process tree ${pid}`);
    const code = await completed;
    if (code !== 0 && groupExists(pid))
      throw new Error(`taskkill failed for process tree ${pid}: ${code}`);
  } finally {
    if (killer.exitCode === null) killer.kill();
  }
}

async function within(promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      promise.then(() => true),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pipeOutput(name, stream, log) {
  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    const lines = (pending + chunk).split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) if (line) log(name, line);
  });
  stream.on("end", () => {
    if (pending) log(name, pending);
  });
}
