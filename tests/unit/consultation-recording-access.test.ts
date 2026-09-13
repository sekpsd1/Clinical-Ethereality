import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  recordingFindFirst: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findFirst: mocks.userFindFirst },
    consultationRecording: { findFirst: mocks.recordingFindFirst },
    $transaction: mocks.transaction
  }
}));
vi.mock("@/lib/audit/audit-log", () => ({ writeAuditLog: mocks.writeAuditLog }));

import { auditRecordingAccess, getAuthorizedRecording } from "@/features/consultations/recordings/access";

const recording = {
  id: "recording-1",
  consultationId: "consultation-1",
  provider: "zoom" as const,
  providerRecordingId: "provider-file-1",
  fileType: "mp4",
  recordingType: "speaker_view",
  fileSizeBytes: BigInt(1024),
  consultation: { zoomMeetingId: "12345678901" }
};

function session(role: "admin" | "doctor" | "customer", userId: string) {
  return { userId, lineUserId: `line-${userId}`, role, expiresAt: "2030-01-01T00:00:00.000Z" } as const;
}

describe("consultation recording authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindFirst.mockResolvedValue({ id: "active-user" });
    mocks.recordingFindFirst.mockResolvedValue(recording);
    mocks.transaction.mockImplementation(async (callback: (tx: object) => unknown) => callback({}));
  });

  it("allows an active admin and the assigned doctor", async () => {
    await expect(getAuthorizedRecording(session("admin", "admin-1"), "consultation-1", "recording-1"))
      .resolves.toMatchObject({ id: "recording-1" });
    expect(mocks.recordingFindFirst.mock.calls[0][0].where).not.toHaveProperty("consultation");

    await expect(getAuthorizedRecording(session("doctor", "doctor-1"), "consultation-1", "recording-1"))
      .resolves.toMatchObject({ id: "recording-1" });
    expect(mocks.recordingFindFirst.mock.calls[1][0].where).toMatchObject({
      consultation: { doctor: { userId: "doctor-1" } }
    });
  });

  it("denies unassigned doctors, customers, anonymous users, and inactive accounts", async () => {
    mocks.recordingFindFirst.mockResolvedValueOnce(null);
    await expect(getAuthorizedRecording(session("doctor", "doctor-other"), "consultation-1", "recording-1"))
      .resolves.toBeNull();
    await expect(getAuthorizedRecording(session("customer", "customer-1-1"), "consultation-1", "recording-1"))
      .resolves.toBeNull();
    await expect(getAuthorizedRecording(null, "consultation-1", "recording-1")).resolves.toBeNull();

    mocks.userFindFirst.mockResolvedValueOnce(null);
    await expect(getAuthorizedRecording(session("admin", "admin-1"), "consultation-1", "recording-1"))
      .resolves.toBeNull();
  });

  it("writes a separate audit trail for every view and download", async () => {
    const authorized = await getAuthorizedRecording(session("doctor", "doctor-1"), "consultation-1", "recording-1");
    expect(authorized).not.toBeNull();
    await auditRecordingAccess(session("doctor", "doctor-1"), authorized!, "view");
    await auditRecordingAccess(session("doctor", "doctor-1"), authorized!, "download");

    expect(mocks.writeAuditLog.mock.calls.map((call) => call[1].action)).toEqual([
      "consultation_recording.view",
      "consultation_recording.download"
    ]);
  });
});
