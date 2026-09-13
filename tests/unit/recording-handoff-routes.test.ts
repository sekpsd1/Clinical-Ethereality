import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ issue: vi.fn(), exchange: vi.fn() }));

vi.mock("@/features/consultations/recordings/external-handoff", () => {
  class RecordingExternalHandoffError extends Error {}
  return {
    issueRecordingExternalHandoff: mocks.issue,
    exchangeRecordingExternalHandoff: mocks.exchange,
    getRecordingExternalCookieName: (mode: string) => `ce_recording_${mode}_access`,
    getRecordingExternalCookieOptions: (consultationId: string, recordingId: string) => ({
      httpOnly: true,
      sameSite: "strict" as const,
      secure: false,
      path: `/api/consultations/${consultationId}/recordings/${recordingId}`,
      maxAge: 7200
    }),
    RecordingExternalHandoffError
  };
});

import { POST as issue } from "@/app/api/consultations/[consultationId]/recordings/[recordingId]/handoff/route";
import { POST as exchange } from "@/app/api/recordings/handoff/session/route";
import { hasTrustedRecordingHandoffOrigin } from "@/features/consultations/recordings/handoff-request";

const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const ticket = `v1.00000000-0000-4000-8000-000000000000.${"a".repeat(43)}`;
const params = Promise.resolve({ consultationId: "consultation-1", recordingId: "recording-1" });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";
  mocks.issue.mockResolvedValue({
    ticket,
    consultationId: "consultation-1",
    recordingId: "recording-1",
    mode: "view",
    expiresAt: new Date("2030-01-01T10:02:00.000Z")
  });
  mocks.exchange.mockResolvedValue({
    externalSessionToken: `v1.00000000-0000-4000-8000-000000000000.${"b".repeat(43)}`,
    consultationId: "consultation-1",
    recordingId: "recording-1",
    mode: "view",
    expiresAt: new Date("2030-01-01T12:00:00.000Z")
  });
});

afterAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
});

describe("recording handoff routes", () => {
  it("issues a fresh fragment-only launch URL from a same-origin POST", async () => {
    const request = new NextRequest(
      "https://app.example.test/api/consultations/consultation-1/recordings/recording-1/handoff",
      {
        method: "POST",
        headers: {
          origin: "https://app.example.test",
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.10, 10.0.0.2"
        },
        body: JSON.stringify({ mode: "view" })
      }
    );
    const response = await issue(request, { params });
    const payload = await response.json();
    const launchUrl = new URL(payload.launchUrl);

    expect(response.status).toBe(200);
    expect(launchUrl.pathname).toBe("/recordings/handoff");
    expect(launchUrl.searchParams.get("consultation")).toBe("consultation-1");
    expect(launchUrl.searchParams.get("recording")).toBe("recording-1");
    expect(launchUrl.searchParams.get("mode")).toBe("view");
    expect(launchUrl.search).not.toContain(ticket);
    expect(launchUrl.hash).toBe(`#handoff=${ticket}`);
    expect(mocks.issue).toHaveBeenCalledWith(
      "consultation-1",
      "recording-1",
      "view",
      { ipAddress: "203.0.113.10" }
    );
  });

  it("rejects cross-origin issuance and malformed modes before minting a ticket", async () => {
    const crossOrigin = await issue(new NextRequest(
      "https://app.example.test/api/consultations/consultation-1/recordings/recording-1/handoff",
      {
        method: "POST",
        headers: { origin: "https://attacker.example", "content-type": "application/json" },
        body: JSON.stringify({ mode: "view" })
      }
    ), { params });
    expect(crossOrigin.status).toBe(403);

    const wrongMode = await issue(new NextRequest(
      "https://app.example.test/api/consultations/consultation-1/recordings/recording-1/handoff",
      {
        method: "POST",
        headers: { origin: "https://app.example.test", "content-type": "application/json" },
        body: JSON.stringify({ mode: "delete" })
      }
    ), { params });
    expect(wrongMode.status).toBe(400);
    expect(mocks.issue).not.toHaveBeenCalled();
  });

  it("exchanges into a mode-specific cookie scoped to the exact recording endpoint", async () => {
    const response = await exchange(new NextRequest(
      "https://app.example.test/api/recordings/handoff/session",
      {
        method: "POST",
        headers: { origin: "https://app.example.test", "content-type": "application/json" },
        body: JSON.stringify({
          ticket,
          consultationId: "consultation-1",
          recordingId: "recording-1",
          mode: "view"
        })
      }
    ));
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(cookie).toContain("ce_recording_view_access=");
    expect(cookie).toContain("Path=/api/consultations/consultation-1/recordings/recording-1");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=strict");
    expect(cookie).not.toContain("ce_recording_download_access");
    expect(mocks.exchange).toHaveBeenCalledWith(
      ticket,
      "consultation-1",
      "recording-1",
      "view"
    );
  });

  it("requires same-origin exchange", async () => {
    const request = new Request("https://internal.example/api", {
      headers: { origin: "https://app.example.test" }
    });
    const attacker = new Request("https://internal.example/api", {
      headers: { origin: "https://attacker.example" }
    });
    expect(hasTrustedRecordingHandoffOrigin(request)).toBe(true);
    expect(hasTrustedRecordingHandoffOrigin(attacker)).toBe(false);

    const response = await exchange(new NextRequest(
      "https://app.example.test/api/recordings/handoff/session",
      {
        method: "POST",
        headers: { origin: "https://attacker.example", "content-type": "application/json" },
        body: JSON.stringify({ ticket, consultationId: "consultation-1", recordingId: "recording-1", mode: "view" })
      }
    ));
    expect(response.status).toBe(403);
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
});
