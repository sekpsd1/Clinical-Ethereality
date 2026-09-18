import { describe, expect, it, vi } from "vitest";
import {
  createRecordingReadinessRequestGate,
  getRecordingReadinessDelayMs,
  requestRecordingReadiness,
  shouldAutoRetryRecordingReadiness
} from "@/features/consultations/recordings/recording-readiness-client";

describe("recording readiness client", () => {
  it("requests the exact private readiness endpoint and accepts a bounded retry", async () => {
    const fetchReadiness = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "processing", retryAfterSeconds: 8 })
    });

    await expect(requestRecordingReadiness(
      "consultation id",
      "recording/id",
      undefined,
      fetchReadiness
    )).resolves.toEqual({ status: "processing", retryAfterSeconds: 8 });
    expect(fetchReadiness).toHaveBeenCalledWith(
      "/api/consultations/consultation%20id/recordings/recording%2Fid/readiness",
      expect.objectContaining({ method: "GET", credentials: "same-origin", cache: "no-store" })
    );
  });

  it.each([
    [{ status: "secret-provider-state" }, true],
    [{ status: "ready", retryAfterSeconds: 600 }, false],
    [{ status: "ready" }, false]
  ])("rejects invalid status or strips an invalid retry hint", async (payload, shouldReject) => {
    const fetchReadiness = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    const promise = requestRecordingReadiness("consultation-1", "recording-1", undefined, fetchReadiness);
    if (shouldReject) {
      await expect(promise).rejects.toThrow("recording_readiness_unavailable");
    } else {
      await expect(promise).resolves.toEqual({ status: "ready" });
    }
  });

  it("uses bounded exponential backoff and retries only non-terminal states", () => {
    expect([0, 1, 2, 3, 4, 5].map((attempt) => getRecordingReadinessDelayMs(attempt))).toEqual([
      2_000,
      4_000,
      8_000,
      16_000,
      30_000,
      30_000
    ]);
    expect(getRecordingReadinessDelayMs(0, 30)).toBe(30_000);
    expect(getRecordingReadinessDelayMs(0, 600)).toBe(30_000);
    expect(shouldAutoRetryRecordingReadiness("processing")).toBe(true);
    expect(shouldAutoRetryRecordingReadiness("retryable")).toBe(true);
    expect(shouldAutoRetryRecordingReadiness("ready")).toBe(false);
    expect(shouldAutoRetryRecordingReadiness("unavailable")).toBe(false);
  });

  it("rejects duplicate readiness work while one request is pending and reopens after completion", async () => {
    const gate = createRecordingReadinessRequestGate();
    let release!: (value: string) => void;
    const firstTask = vi.fn(() => new Promise<string>((resolve) => {
      release = resolve;
    }));
    const duplicateTask = vi.fn().mockResolvedValue("duplicate");

    const first = gate.run(firstTask);
    await expect(gate.run(duplicateTask)).resolves.toBeNull();
    expect(duplicateTask).not.toHaveBeenCalled();

    release("first");
    await expect(gate.waitForIdle()).resolves.toBeUndefined();
    await expect(first).resolves.toBe("first");
    await expect(gate.run(() => Promise.resolve("next-cycle"))).resolves.toBe("next-cycle");
  });

  it("reopens the readiness gate after a failed request", async () => {
    const gate = createRecordingReadinessRequestGate();

    await expect(gate.run(() => Promise.reject(new Error("temporary")))).rejects.toThrow("temporary");
    await expect(gate.run(() => Promise.resolve("retry"))).resolves.toBe("retry");
  });
});
