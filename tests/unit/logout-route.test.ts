import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearSessionCookies: vi.fn((response) => response),
  revokeSessionFromToken: vi.fn()
}));

vi.mock("@/lib/auth/cookies", () => ({
  authCookieNames: { refresh: "ce_refresh" }
}));

vi.mock("@/lib/auth/session", () => ({
  clearSessionCookies: mocks.clearSessionCookies,
  revokeSessionFromToken: mocks.revokeSessionFromToken
}));

import { POST } from "@/app/api/auth/logout/route";

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.revokeSessionFromToken.mockResolvedValue(undefined);
  });

  it("revokes only the refresh token presented by the current browser and clears its cookies", async () => {
    const request = new NextRequest("https://app.example.test/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: "ce_refresh=current-browser-refresh"
      }
    });

    const response = await POST(request);
    await vi.waitFor(() => {
      expect(mocks.revokeSessionFromToken).toHaveBeenCalledWith("current-browser-refresh");
    });

    expect(mocks.revokeSessionFromToken).toHaveBeenCalledTimes(1);
    expect(mocks.clearSessionCookies).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("clears local session cookies without revoking an unrelated session when no refresh token is present", async () => {
    const request = new NextRequest("https://app.example.test/api/auth/logout", {
      method: "POST"
    });

    const response = await POST(request);

    expect(mocks.revokeSessionFromToken).not.toHaveBeenCalled();
    expect(mocks.clearSessionCookies).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
