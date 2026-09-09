import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  session: null as null | { userId: string; lineUserId: string; role: "doctor" | "admin" | "customer"; expiresAt: string },
  authorize: vi.fn(),
  audit: vi.fn(),
  open: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentSession: () => mocks.session }));
vi.mock("@/features/consultations/recordings/access", () => ({
  getAuthorizedRecording: mocks.authorize,
  auditRecordingAccess: mocks.audit
}));
vi.mock("@/features/consultations/recordings/provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/consultations/recordings/provider")>();
  return { ...actual, zoomRecordingContentProvider: { open: mocks.open } };
});

import { GET } from "@/app/api/consultations/[consultationId]/recordings/[recordingId]/route";

const params = Promise.resolve({ consultationId: "consultation-1", recordingId: "recording-1" });
const recording = {
  id: "recording-1",
  consultationId: "consultation-1",
  provider: "zoom" as const,
  providerRecordingId: "provider-file-1",
  fileType: "mp4",
  recordingType: "speaker_view",
  zoomMeetingId: "12345678901"
};

describe("private consultation recording route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = null;
    mocks.authorize.mockResolvedValue(recording);
    mocks.open.mockResolvedValue({
      body: new Response("private-bytes").body,
      contentType: "video/mp4",
      contentLength: "13"
    });
  });

  it("denies anonymous access before authorization or provider calls", async () => {
    const response = await GET(new NextRequest("http://localhost/api/consultations/consultation-1/recordings/recording-1"), { params });
    expect(response.status).toBe(401);
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("returns not found for a caller without an authorized recording", async () => {
    mocks.session = { userId: "customer-1", lineUserId: "line-customer", role: "customer", expiresAt: "2030-01-01T00:00:00.000Z" };
    mocks.authorize.mockResolvedValue(null);
    const response = await GET(new NextRequest("http://localhost/api/consultations/consultation-1/recordings/recording-1"), { params });
    expect(response.status).toBe(404);
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("proxies private content and audits an assigned doctor's download", async () => {
    mocks.session = { userId: "doctor-1", lineUserId: "line-doctor", role: "doctor", expiresAt: "2030-01-01T00:00:00.000Z" };
    const response = await GET(new NextRequest("http://localhost/api/consultations/consultation-1/recordings/recording-1?download=1"), { params });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(await response.text()).toBe("private-bytes");
    expect(mocks.audit).toHaveBeenCalledWith(mocks.session, recording, "download");
  });
});
