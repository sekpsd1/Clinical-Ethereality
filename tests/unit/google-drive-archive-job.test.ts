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
