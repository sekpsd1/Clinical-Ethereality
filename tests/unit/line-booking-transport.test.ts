import { afterEach, describe, expect, it, vi } from "vitest";
import { pushLineBookingAlert } from "@/lib/notifications/line-push";
import { POST } from "@/app/api/jobs/line-booking-alerts/route";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@/features/notifications/line-booking-job", () => ({ runLineBookingAlerts: mocks.run }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
const input = { token: "mock-token", lineUserId: `U${"a".repeat(32)}`, retryKey: "123e4567-e89b-42d3-a456-426614174000", text: "ข้อความจำลอง" };

describe("LINE booking push transport", () => {
  it("uses push only, a stable retry header, and one minimal text message", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await pushLineBookingAlert(input)).toBe("accepted");
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.line.me/v2/bot/message/push");
    expect(request.headers["X-Line-Retry-Key"]).toBe(input.retryKey);
    expect(JSON.parse(request.body)).toEqual({ to: input.lineUserId, messages: [{ type: "text", text: input.text }] });
    expect(request.redirect).toBe("error");
  });

  it.each([400, 401, 403, 409, 429])("requires attention for %s without automatic retries", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
    expect(await pushLineBookingAlert(input)).toBe("failed");
  });

  it("treats an acknowledged retry conflict as accepted", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 409, headers: { "x-line-accepted-request-id": "mock-request" } })));
    expect(await pushLineBookingAlert(input)).toBe("accepted");
  });

  it("retries transient errors and timeouts with no provider payload reads", async () => {
    const json = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ status: 503, ok: false, json }).mockRejectedValueOnce(new Error("mock timeout")));
    expect(await pushLineBookingAlert(input)).toBe("retry");
    expect(await pushLineBookingAlert(input)).toBe("retry");
    expect(json).not.toHaveBeenCalled();
  });
});

describe("LINE booking job authorization", () => {
  const request = (secret?: string) => new NextRequest("https://example.test/api/jobs/line-booking-alerts", {
    method: "POST", headers: secret ? { "x-clinical-job-secret": secret } : {}
  });

  it("rejects missing configuration and wrong secrets before touching jobs", async () => {
    vi.stubEnv("LINE_BOOKING_ALERT_JOB_SECRET", "");
    expect((await POST(request())).status).toBe(503);
    vi.stubEnv("LINE_BOOKING_ALERT_JOB_SECRET", "x".repeat(32));
    expect((await POST(request("wrong"))).status).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("returns only aggregate results and a failed monitor signal for missed deliveries", async () => {
    vi.stubEnv("LINE_BOOKING_ALERT_JOB_SECRET", "x".repeat(32));
    mocks.run.mockResolvedValue({ disabled: false, claimed: 1, accepted: 1, deferred: 0, attentionRequired: 1 });
    const response = await POST(request("x".repeat(32)));
    expect(await response.json()).toEqual({ ok: false, result: { disabled: false, claimed: 1, accepted: 1, deferred: 0, attentionRequired: 1 } });
  });

  it("sanitizes job exceptions", async () => {
    vi.stubEnv("LINE_BOOKING_ALERT_JOB_SECRET", "x".repeat(32));
    mocks.run.mockRejectedValue(new Error("private provider data"));
    const response = await POST(request("x".repeat(32)));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private provider data");
  });
});
