import { describe, expect, it } from "vitest";

import { runApplicationEffect } from "@/application/effect";
import { makeApplicationLifecycleMachine } from "@/application/lifecycle";

describe("Application lifecycle", () => {
  it("transitions through successful startup and disposal", async () => {
    const machine = await runApplicationEffect(makeApplicationLifecycleMachine());

    await expect(
      runApplicationEffect(machine.dispatch({ type: "startRequested" })),
    ).resolves.toMatchObject({ from: "created", to: "starting" });
    await expect(
      runApplicationEffect(machine.dispatch({ type: "startSucceeded" })),
    ).resolves.toMatchObject({ from: "starting", to: "started" });
    await expect(
      runApplicationEffect(machine.dispatch({ type: "disposeRequested" })),
    ).resolves.toMatchObject({ from: "started", to: "disposing" });
    await expect(
      runApplicationEffect(machine.dispatch({ type: "disposeCompleted" })),
    ).resolves.toMatchObject({ from: "disposing", to: "disposed" });
    await expect(runApplicationEffect(machine.state)).resolves.toBe("disposed");
  });

  it("returns to created after failed startup so a retry can begin", async () => {
    const machine = await runApplicationEffect(makeApplicationLifecycleMachine());

    await runApplicationEffect(machine.dispatch({ type: "startRequested" }));
    await runApplicationEffect(machine.dispatch({ type: "startRolledBack" }));
    await expect(runApplicationEffect(machine.state)).resolves.toBe("created");
    await expect(
      runApplicationEffect(machine.dispatch({ type: "startRequested" })),
    ).resolves.toMatchObject({ from: "created", to: "starting" });
  });

  it("allows an unstarted application to dispose and rejects terminal transitions", async () => {
    const machine = await runApplicationEffect(makeApplicationLifecycleMachine());

    await runApplicationEffect(machine.dispatch({ type: "disposeRequested" }));
    await runApplicationEffect(machine.dispatch({ type: "disposeCompleted" }));

    await expect(
      runApplicationEffect(machine.dispatch({ type: "startRequested" })),
    ).rejects.toMatchObject({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "Invalid application lifecycle transition: disposed -> startRequested",
      details: { state: "disposed", event: "startRequested" },
    });
  });
});
