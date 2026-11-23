import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/jobs/line-booking-alert-smoke/route";

const mocks = vi.hoisted(() => ({ findUsers: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findMany: mocks.findUsers } } }));

const jobSecret = "j".repeat(48);
const scope = {
  startsAt: "2026-11-23T04:00:00.000Z",
  expiresAt: "2026-11-23T04:15:00.000Z",
  sendKey: "c".repeat(64),
  doctor: {
    userId: "fixture-doctor",
    lineUserId: `U${"a".repeat(32)}`,
    retryKey: "123e4567-e89b-42d3-a456-426614174001"
  },
  admin: {
    userId: "fixture-admin",
    lineUserId: `U${"b".repeat(32)}`,
    retryKey: "123e4567-e89b-42d3-a456-426614174002"
  }
};
const doctor = {
  id: scope.doctor.userId,
  role: "doctor",
  status: "active",
  lineUserId: scope.doctor.lineUserId,
  doctorProfile: { status: "approved" }
};
const admin = {
  id: scope.admin.userId,
  role: "admin",
  status: "active",
  lineUserId: scope.admin.lineUserId,
  doctorProfile: null
};
const pushPath = "/v2/bot/message/push";
const provider = vi.fn<(url: string | URL, init?: RequestInit) => Promise<Response>>();

function request(action = "preflight", secret = jobSecret, sendKey = scope.sendKey) {
  return new NextRequest("https://example.test/api/jobs/line-booking-alert-smoke", {
    method: "POST",
    headers: {
      "x-clinical-job-secret": secret,
      "x-clinical-line-smoke-action": action,
      "x-clinical-line-smoke-key": sendKey
    }
  });
}

function providerPaths() {
  return provider.mock.calls.map(([url]) => new URL(url).pathname);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-23T04:05:00.000Z"));
  vi.stubEnv("LINE_BOOKING_ALERT_SMOKE_SCOPE", JSON.stringify(scope));
  vi.stubEnv("LINE_BOOKING_ALERT_JOB_SECRET", jobSecret);
  vi.stubEnv("ENABLE_LINE_BOOKING_ALERTS", "false");
  vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "fixture-token");
  mocks.findUsers.mockResolvedValue([doctor, admin]);

  const acceptedKeys = new Set<string>();
  provider.mockImplementation(async (url, init) => {
    const path = new URL(url).pathname;
    if (path === "/v2/bot/info") return Response.json({ basicId: "@vwe9449c" });
    if (path.startsWith("/v2/bot/profile/")) {
      return Response.json({ userId: path.split("/").at(-1) });
    }
    if (path === pushPath && init?.method === "POST") {
      const key = new Headers(init.headers).get("X-Line-Retry-Key");
      if (!key) throw new Error("Missing LINE retry key");
      if (acceptedKeys.has(key)) {
        return new Response(null, { status: 409, headers: { "x-line-accepted-request-id": "fixture" } });
      }
      acceptedKeys.add(key);
      return new Response(null, { status: 200 });
    }
    throw new Error("Unexpected provider call");
  });
  vi.stubGlobal("fetch", provider);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("LINE booking smoke route", () => {
  it.each([
    ["missing scope", undefined],
    ["malformed JSON", "}"],
    ["unexpected scope field", JSON.stringify({ ...scope, recipient: "other" })],
    ["duplicate retry keys", JSON.stringify({ ...scope, admin: { ...scope.admin, retryKey: scope.doctor.retryKey } })]
  ])("returns 404 before work for %s", async (_label, envValue) => {
    vi.stubEnv("LINE_BOOKING_ALERT_SMOKE_SCOPE", envValue);
    expect((await POST(request("send"))).status).toBe(404);
    expect(mocks.findUsers).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });

  it.each(["2026-11-23T03:59:59.999Z", scope.expiresAt])(
    "rejects requests outside the configured window (%s)",
    async (requestTime) => {
      vi.setSystemTime(new Date(requestTime));
      expect((await POST(request("send"))).status).toBe(404);
      expect(mocks.findUsers).not.toHaveBeenCalled();
      expect(provider).not.toHaveBeenCalled();
    }
  );

  it("rejects a smoke send while normal delivery is enabled", async () => {
    vi.stubEnv("ENABLE_LINE_BOOKING_ALERTS", "true");
    expect((await POST(request("send"))).status).toBe(404);
    expect(mocks.findUsers).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });

  it("requires job authorization and a separate key for sending", async () => {
    expect((await POST(request("preflight", "incorrect"))).status).toBe(401);
    expect((await POST(request("send", jobSecret, "incorrect"))).status).toBe(401);
    expect((await POST(request("unknown"))).status).toBe(400);
    expect(mocks.findUsers).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });

  it("blocks before touching users or LINE when the channel token is absent", async () => {
    vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", undefined);
    const response = await POST(request("send"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, result: { state: "token_unavailable" } });
    expect(mocks.findUsers).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([
    ["doctor approval", [{ ...doctor, doctorProfile: { status: "pending" } }, admin]],
    ["admin LINE identity", [doctor, { ...admin, lineUserId: `U${"c".repeat(32)}` }]]
  ])("blocks sends when the %s changes", async (_label, users) => {
    mocks.findUsers.mockResolvedValue(users);
    const response = await POST(request("send"));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, result: { state: "recipient_mismatch" } });
    expect(provider).not.toHaveBeenCalled();
  });

  it("blocks sends when the channel belongs to another Official Account", async () => {
    provider.mockResolvedValueOnce(Response.json({ basicId: "@different" }));

    const response = await POST(request("send"));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, result: { state: "oa_unverified" } });
    expect(providerPaths()).toEqual(["/v2/bot/info"]);
  });

  it("holds both sends when either LINE profile cannot be confirmed", async () => {
    provider.mockImplementation(async (url) => {
      const path = new URL(url).pathname;
      if (path === "/v2/bot/info") return Response.json({ basicId: "@vwe9449c" });
      if (path.endsWith(scope.doctor.lineUserId)) return Response.json({ userId: scope.doctor.lineUserId });
      return new Response(null, { status: 404 });
    });

    const response = await POST(request("send"));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, result: { state: "profile_unverified" } });
    expect(providerPaths()).toContain(`/v2/bot/profile/${scope.admin.lineUserId}`);
    expect(providerPaths()).not.toContain(pushPath);
  });

  it("does not send when the window expires during profile verification", async () => {
    provider.mockImplementation(async (url) => {
      const path = new URL(url).pathname;
      if (path === "/v2/bot/info") return Response.json({ basicId: "@vwe9449c" });
      vi.setSystemTime(new Date(scope.expiresAt));
      return Response.json({ userId: path.split("/").at(-1) });
    });

    expect((await POST(request("send"))).status).toBe(404);
    expect(providerPaths()).not.toContain(pushPath);
  });

  it("checks the expected Official Account and both profiles without sending during preflight", async () => {
    const response = await POST(request("preflight", jobSecret, ""));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, result: { state: "ready" } });
    expect(mocks.findUsers).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: [scope.doctor.userId, scope.admin.userId] } }
    }));
    expect(providerPaths().sort()).toEqual([
      "/v2/bot/info",
      `/v2/bot/profile/${scope.doctor.lineUserId}`,
      `/v2/bot/profile/${scope.admin.lineUserId}`
    ]);
  });

  it("checks both profiles before sending and reuses the exact LINE retry key on replay", async () => {
    const first = await POST(request("send"));
    const second = await POST(request("send"));

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      ok: true, result: { state: "attempted", doctor: "accepted", admin: "accepted" }
    });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({
      ok: true, result: { state: "attempted", doctor: "accepted", admin: "accepted" }
    });
    const paths = providerPaths();
    const firstPush = paths.indexOf(pushPath);
    expect(paths.slice(0, firstPush)).toEqual(expect.arrayContaining([
      "/v2/bot/info",
      `/v2/bot/profile/${scope.doctor.lineUserId}`,
      `/v2/bot/profile/${scope.admin.lineUserId}`
    ]));
    const pushes = provider.mock.calls
      .filter(([url]) => new URL(url).pathname === pushPath)
      .map(([, init]) => ({
        method: init?.method,
        retryKey: new Headers(init?.headers).get("X-Line-Retry-Key"),
        body: JSON.parse(String(init?.body))
      }));

    for (const recipient of [scope.doctor, scope.admin]) {
      expect(pushes.filter((push) => push.body.to === recipient.lineUserId)).toEqual(
        Array.from({ length: 2 }, () => ({
          method: "POST",
          retryKey: recipient.retryKey,
          body: {
            to: recipient.lineUserId,
            messages: [{ type: "text", text: "ทดสอบการรับแจ้งเตือนจากคลินิก" }]
          }
        }))
      );
    }
    expect(pushes).toHaveLength(4);
  });
});
