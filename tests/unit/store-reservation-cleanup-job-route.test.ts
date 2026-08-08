import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAppEnv: vi.fn(),
  releaseExpiredStoreOrderReservations: vi.fn()
}));

vi.mock("@/lib/env/schema", () => ({
  getAppEnv: mocks.getAppEnv
}));

vi.mock("@/features/orders/reservations", () => ({
  releaseExpiredStoreOrderReservations: mocks.releaseExpiredStoreOrderReservations
}));

import { POST } from "@/app/api/jobs/store-reservation-cleanup/route";

function request(secret?: string) {
  return new NextRequest("http://localhost/api/jobs/store-reservation-cleanup", {
    method: "POST",
    headers: secret ? { "x-clinical-job-secret": secret } : undefined
  });
}

describe("Store reservation cleanup job route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAppEnv.mockReturnValue({
      STORE_RESERVATION_CLEANUP_SECRET: "a-secure-test-secret-with-at-least-32-characters"
    });
    mocks.releaseExpiredStoreOrderReservations.mockResolvedValue({
      candidates: 2,
      released: 1,
      skipped: 1
    });
  });

  it("rejects an unauthorized scheduled request before cleanup runs", async () => {
    const response = await POST(request("wrong-secret"));

    expect(response.status).toBe(401);
    expect(mocks.releaseExpiredStoreOrderReservations).not.toHaveBeenCalled();
  });

  it("fails closed when the server-only cleanup secret is not configured", async () => {
    mocks.getAppEnv.mockReturnValue({ STORE_RESERVATION_CLEANUP_SECRET: undefined });

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(mocks.releaseExpiredStoreOrderReservations).not.toHaveBeenCalled();
  });

  it("runs the existing global cleanup service only for the configured secret", async () => {
    const response = await POST(request("a-secure-test-secret-with-at-least-32-characters"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      result: {
        candidates: 2,
        released: 1,
        skipped: 1
      }
    });
    expect(mocks.releaseExpiredStoreOrderReservations).toHaveBeenCalledWith();
  });
});
