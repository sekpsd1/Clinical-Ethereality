import { describe, expect, it, vi } from "vitest";
import {
  resetCompletedSingleFlight,
  runSingleFlight
} from "@/features/identity-verification/single-flight";

describe("identity verification request single-flight guard", () => {
  it("dispatches at most one request while the first request is pending", async () => {
    const lock = { current: "idle" as const };
    let release: (() => void) | undefined;
    const operation = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );

    const first = runSingleFlight(lock, operation);
    const second = runSingleFlight(lock, operation);
    const third = runSingleFlight(lock, operation);

    expect(operation).toHaveBeenCalledTimes(1);
    await expect(second).resolves.toBeUndefined();
    await expect(third).resolves.toBeUndefined();

    release?.();
    await expect(first).resolves.toBeUndefined();
    expect(lock.current).toBe("idle");
  });

  it("retains a successful request through the immediate post-response render gap", async () => {
    const lock: { current: "idle" | "pending" | "succeeded" } = { current: "idle" };
    const operation = vi.fn(async () => ({ ok: true }));

    await expect(
      runSingleFlight(lock, operation, { retainWhen: (result) => result.ok })
    ).resolves.toEqual({ ok: true });
    await expect(
      runSingleFlight(lock, operation, { retainWhen: (result) => result.ok })
    ).resolves.toBeUndefined();

    expect(operation).toHaveBeenCalledTimes(1);
    expect(lock.current).toBe("succeeded");
  });

  it("resets only a completed request and never unlocks a pending request", async () => {
    const succeeded: { current: "idle" | "pending" | "succeeded" } = { current: "succeeded" };
    const pending: { current: "idle" | "pending" | "succeeded" } = { current: "pending" };

    resetCompletedSingleFlight(succeeded);
    resetCompletedSingleFlight(pending);

    expect(succeeded.current).toBe("idle");
    expect(pending.current).toBe("pending");
  });
});
