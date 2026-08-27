import { describe, expect, it, vi } from "vitest";
import { runSingleFlight } from "@/features/identity-verification/single-flight";

describe("identity verification request single-flight guard", () => {
  it("dispatches at most one request while the first request is pending", async () => {
    const lock = { current: false };
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
    expect(lock.current).toBe(false);
  });
});
