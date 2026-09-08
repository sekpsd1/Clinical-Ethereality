import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  issue: vi.fn(),
  exchange: vi.fn(),
  revoke: vi.fn(),
  viewer: vi.fn()
}));

vi.mock("@/features/consultations/zoom/external-handoff", () => {
  class ZoomExternalHandoffError extends Error {}

  return {
    issueZoomExternalHandoff: mocks.issue,
    exchangeZoomExternalHandoff: mocks.exchange,
    revokeCurrentZoomExternalSession: mocks.revoke,
    getZoomExternalViewer: mocks.viewer,
    getZoomExternalAccessCookieOptions: (maxAge = 7200) => ({
      httpOnly: true,
      sameSite: "strict" as const,
      secure: false,
      path: "/api",
      maxAge
    }),
    zoomExternalAccessCookieName: "ce_zoom_access",
    ZoomExternalHandoffError
  };
});

import { POST as issueHandoff } from "@/app/api/consultations/[consultationId]/zoom-handoff/route";
import {
  GET as validateHandoffSession,
  POST as exchangeHandoff
} from "@/app/api/zoom/handoff/session/route";
import { POST as leaveHandoffSession } from "@/app/api/zoom/handoff/session/leave/route";
import {
  getRequestIpAddress,
  hasTrustedZoomHandoffOrigin
} from "@/features/consultations/zoom/handoff-request";

const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const previousLiffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
const ticket = `v1.00000000-0000-4000-8000-000000000000.${"a".repeat(43)}`;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";
  process.env.NEXT_PUBLIC_LINE_LIFF_ID = "1234567890-AbcdEfgh";
  mocks.issue.mockResolvedValue({
    ticket,
    consultationId: "consultation-1",
    expiresAt: new Date("2030-01-01T10:02:00.000Z")
  });
  mocks.exchange.mockResolvedValue({
    externalSessionToken: "v1.00000000-0000-4000-8000-000000000000.scope",
    consultationId: "consultation-1",
    role: "customer",
    expiresAt: new Date("2030-01-01T12:00:00.000Z")
  });
  mocks.viewer.mockResolvedValue({ userId: "customer-1", role: "customer" });
  mocks.revoke.mockResolvedValue({ revoked: true, consultationId: "consultation-1" });
});

afterAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
  process.env.NEXT_PUBLIC_LINE_LIFF_ID = previousLiffId;
});

describe("Zoom handoff routes", () => {
  it("issues a same-origin external URL with the secret only in the fragment", async () => {
    const request = new NextRequest("https://app.example.test/api/consultations/consultation-1/zoom-handoff", {
      method: "POST",
      headers: {
        origin: "https://app.example.test",
        "x-forwarded-for": "203.0.113.10, 10.0.0.2"
      }
    });
    const response = await issueHandoff(request, {
      params: Promise.resolve({ consultationId: "consultation-1" })
    });
    const body = await response.json();
    const launchUrl = new URL(body.launchUrl);

    expect(response.status).toBe(200);
    expect(launchUrl.origin).toBe("https://app.example.test");
    expect(launchUrl.pathname).toBe("/zoom-sdk/index.html");
    expect(launchUrl.searchParams.get("consultation")).toBe("consultation-1");
    expect(launchUrl.search).not.toContain(ticket);
    expect(launchUrl.hash).toContain("handoff=");
    expect(mocks.issue).toHaveBeenCalledWith("consultation-1", { ipAddress: "203.0.113.10" });
  });

  it("rejects cross-origin issuance before creating a ticket", async () => {
    const request = new NextRequest("https://app.example.test/api/consultations/consultation-1/zoom-handoff", {
      method: "POST",
      headers: { origin: "https://attacker.example" }
    });
    const response = await issueHandoff(request, {
      params: Promise.resolve({ consultationId: "consultation-1" })
    });

    expect(response.status).toBe(403);
    expect(mocks.issue).not.toHaveBeenCalled();
  });

  it("exchanges the ticket into an HttpOnly API-scoped cookie", async () => {
    const request = new NextRequest("https://app.example.test/api/zoom/handoff/session", {
      method: "POST",
      headers: {
        origin: "https://app.example.test",
        "content-type": "application/json"
      },
      body: JSON.stringify({ ticket })
    });
    const response = await exchangeHandoff(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("ce_zoom_access=");
    expect(response.headers.get("set-cookie")).toContain("Path=/api");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=strict");
    expect(mocks.exchange).toHaveBeenCalledWith(ticket);
  });

  it("validates a scoped session without minting Zoom join credentials", async () => {
    const request = new NextRequest(
      "https://app.example.test/api/zoom/handoff/session?consultation=consultation-1"
    );
    const response = await validateHandoffSession(request);

    expect(response.status).toBe(200);
    expect(mocks.viewer).toHaveBeenCalledWith("consultation-1");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("revokes and clears only the external Zoom cookie on a same-origin leave", async () => {
    const request = new NextRequest("https://app.example.test/api/zoom/handoff/session/leave", {
      method: "POST",
      headers: { origin: "https://app.example.test" }
    });
    const response = await leaveHandoffSession(request);
    const body = await response.json();
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      revoked: true,
      returnToLineUrl: "https://miniapp.line.me/1234567890-AbcdEfgh/profile"
    });
    expect(mocks.revoke).toHaveBeenCalledOnce();
    expect(setCookie).toContain("ce_zoom_access=");
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("Path=/api");
    expect(setCookie).not.toContain("ce_access");
    expect(setCookie).not.toContain("ce_refresh");
  });

  it("rejects a cross-origin leave without revoking or clearing the Zoom cookie", async () => {
    const request = new NextRequest("https://app.example.test/api/zoom/handoff/session/leave", {
      method: "POST",
      headers: { origin: "https://attacker.example" }
    });
    const response = await leaveHandoffSession(request);

    expect(response.status).toBe(403);
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("does not report leave success when the external session is missing or expired", async () => {
    mocks.revoke.mockResolvedValue({ revoked: false });
    const request = new NextRequest("https://app.example.test/api/zoom/handoff/session/leave", {
      method: "POST",
      headers: { origin: "https://app.example.test" }
    });
    const response = await leaveHandoffSession(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      revoked: false,
      error: "zoom_external_session_unavailable"
    });
    expect(response.headers.get("set-cookie")).toContain("ce_zoom_access=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("normalizes same-origin checks and accepts only a bounded forwarded IP", () => {
    const trusted = new Request("https://internal.example/api", {
      headers: {
        origin: "https://app.example.test",
        "x-forwarded-for": "198.51.100.4, 10.0.0.1"
      }
    });
    const untrusted = new Request("https://internal.example/api", {
      headers: { origin: "https://attacker.example" }
    });

    expect(hasTrustedZoomHandoffOrigin(trusted)).toBe(true);
    expect(hasTrustedZoomHandoffOrigin(untrusted)).toBe(false);
    expect(getRequestIpAddress(trusted)).toBe("198.51.100.4");
  });
});
