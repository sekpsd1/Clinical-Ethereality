import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ enabled: true, secret: "x".repeat(32), step: vi.fn() }));
vi.mock("@/lib/env/schema", () => ({ getAppEnv: () => ({ ENABLE_GOOGLE_DRIVE_RECORDING_ARCHIVE: mocks.enabled,
  GOOGLE_DRIVE_ARCHIVE_JOB_SECRET: mocks.secret }) }));
vi.mock("@/features/consultations/recordings/drive-archive", () => ({ archiveOneRecordingStep: mocks.step }));
import { POST } from "@/app/api/jobs/recording-archive/route";
beforeEach(() => { mocks.enabled = true; mocks.step.mockReset(); });
it("blocks unconfigured job without mutation", async () => {
  mocks.enabled = false;
  expect((await POST(new NextRequest("https://test.example/api/jobs/recording-archive", { method: "POST" }))).status).toBe(503);
  expect(mocks.step).not.toHaveBeenCalled();
});
it("blocks absent/wrong job secret without mutation", async () => {
  expect((await POST(new NextRequest("https://test.example/api/jobs/recording-archive", { method: "POST",
    headers: { "x-clinical-job-secret": "y".repeat(32) } }))).status).toBe(401);
  expect(mocks.step).not.toHaveBeenCalled();
});
it("returns aggregate progress without exposing IDs or credentials", async () => {
  mocks.step.mockResolvedValue({ status: "progress" });
  const response = await POST(new NextRequest("https://test.example/api/jobs/recording-archive", { method: "POST",
    headers: { "x-clinical-job-secret": mocks.secret } }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, result: { status: "progress" } });
});

const target = { recordingId: "recording-test", consultationId: "consult-test", providerRecordingId: "provider-test",
  zoomMeetingId: "meeting-test", fileSizeBytes: "4", fileType: "mp4", recordingType: "shared_screen_with_speaker_view" };
const request = (body: string, type = "application/json", secret = mocks.secret) => new NextRequest("https://test.example/api/jobs/recording-archive", {
  method: "POST", headers: { "x-clinical-job-secret": secret, "content-type": type }, body });
it("passes an exact immutable target only after authentication", async () => {
  mocks.step.mockResolvedValue({ status: "progress", targetMatched: true });
  const response = await POST(request(JSON.stringify({ target })));
  expect(mocks.step).toHaveBeenCalledWith(target);
  expect(await response.json()).toEqual({ ok: true, result: { status: "progress", targetMatched: true } });
});
it.each(["{", " ", "{}", JSON.stringify({ target, unexpected: true }), JSON.stringify({ target: { ...target, fileSizeBytes: "0" } }),
  JSON.stringify({ target: { ...target, fileType: "txt" } }), JSON.stringify({ target: { ...target, recordingId: "x\nsecret" } }), "x".repeat(2049)])(
  "rejects malformed/oversized target body without queue fallback: %s", async body => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.step).not.toHaveBeenCalled();
  });
it("rejects target with wrong MIME or secret before invoking the queue", async () => {
  expect((await POST(request(JSON.stringify({ target }), "text/plain"))).status).toBe(400);
  expect((await POST(request("x".repeat(5000), "application/json", "wrong"))).status).toBe(401);
  expect(mocks.step).not.toHaveBeenCalled();
});
it("bounds actual streamed bytes despite a small declared length and cancels input", async () => {
  const cancel = vi.fn();
  let reads = 0;
  const body = new ReadableStream({ pull(c) { reads++; c.enqueue(new Uint8Array(1100)); }, cancel }, { highWaterMark: 0 });
  const input = new NextRequest("https://test.example/api/jobs/recording-archive", {
    method: "POST", headers: { "x-clinical-job-secret": mocks.secret, "content-type": "application/json", "content-length": "1" },
    body, duplex: "half"
  } as ConstructorParameters<typeof NextRequest>[1]);
  expect((await POST(input)).status).toBe(400);
  expect(reads).toBe(2); expect(cancel).toHaveBeenCalledOnce(); expect(mocks.step).not.toHaveBeenCalled();
});
it("times out a stalled request body without mutation", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  try {
    const body = new ReadableStream({ pull() { return new Promise(() => undefined); }, cancel }, { highWaterMark: 0 });
    const input = new NextRequest("https://test.example/api/jobs/recording-archive", {
      method: "POST", headers: { "x-clinical-job-secret": mocks.secret }, body, duplex: "half"
    } as ConstructorParameters<typeof NextRequest>[1]);
    const result = POST(input);
    await vi.advanceTimersByTimeAsync(5000);
    expect((await result).status).toBe(400); expect(cancel).toHaveBeenCalledOnce(); expect(mocks.step).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});
