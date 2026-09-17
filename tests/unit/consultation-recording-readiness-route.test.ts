import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: null as null | { userId: string; role: "doctor" | "admin" | "customer" },
  authorize: vi.fn(),
  getReadiness: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentSession: () => mocks.session }));
vi.mock("@/features/consultations/recordings/access", () => ({
  getAuthorizedRecording: mocks.authorize
}));
vi.mock("@/features/consultations/recordings/provider", () => ({
  zoomRecordingContentProvider: { getReadiness: mocks.getReadiness }
}));

import { GET } from "@/app/api/consultations/[consultationId]/recordings/[recordingId]/readiness/route";

const params = Promise.resolve({ consultationId: "consultation-1", recordingId: "recording-1" });
const recording = {
  id: "recording-1",
  consultationId: "consultation-1",
  provider: "zoom" as const,
  providerRecordingId: "provider-file-1",
  fileType: "mp4",
  recordingType: "shared_screen_with_speaker_view",
  zoomMeetingId: "12345678901",
  fileSizeBytes: BigInt(1024)
};

describe("private consultation recording readiness route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = null;
    mocks.authorize.mockResolvedValue(null);
    mocks.getReadiness.mockResolvedValue({ status: "ready" });
  });

  it.each([
    ["anonymous", null],
    ["customer", { userId: "customer-1", role: "customer" as const }],
    ["unassigned doctor", { userId: "doctor-2", role: "doctor" as const }]
  ])("denies %s generically before provider access", async (_label, session) => {
    mocks.session = session;
    const response = await GET(new Request("http://localhost/readiness"), { params });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Recording not found." });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.getReadiness).not.toHaveBeenCalled();
  });

  it.each(["doctor", "admin"] as const)("returns only coarse readiness to an authorized %s", async (role) => {
    mocks.session = { userId: `${role}-1`, role };
    mocks.authorize.mockResolvedValue(recording);
    mocks.getReadiness.mockResolvedValue({ status: "retryable", retryAfterSeconds: 8 });

    const response = await GET(new Request("http://localhost/readiness"), { params });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "retryable", retryAfterSeconds: 8 });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.getReadiness).toHaveBeenCalledWith(recording);
  });

  it("rejects an ineligible recording returned by an upstream mock", async () => {
    mocks.session = { userId: "admin-1", role: "admin" };
    mocks.authorize.mockResolvedValue({ ...recording, fileType: "m4a", recordingType: "audio_only" });

    const response = await GET(new Request("http://localhost/readiness"), { params });

    expect(response.status).toBe(404);
    expect(mocks.getReadiness).not.toHaveBeenCalled();
  });
});
