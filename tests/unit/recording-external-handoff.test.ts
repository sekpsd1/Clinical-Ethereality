import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    user: { findFirst: vi.fn() },
    consultationRecording: { findFirst: vi.fn() },
    authSession: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn() }
  };
  return {
    session: null as null | { userId: string; role: "admin" | "doctor" | "customer" },
    cookieValue: null as string | null,
    cookieName: null as string | null,
    tx,
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    writeAuditLog: vi.fn()
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => name === mocks.cookieName && mocks.cookieValue
      ? { value: mocks.cookieValue }
      : undefined
  })
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: async () => mocks.session }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { ...mocks.tx, $transaction: mocks.transaction } }));
vi.mock("@/lib/audit/audit-log", () => ({ writeAuditLog: mocks.writeAuditLog }));

import {
  auditExternalRecordingAccessOnce,
  exchangeRecordingExternalHandoff,
  getRecordingExternalAccess,
  getRecordingExternalCookieName,
  getRecordingExternalCookieOptions,
  issueRecordingExternalHandoff,
  recordingExternalHandoffLimits,
  RecordingExternalHandoffError
} from "@/features/consultations/recordings/external-handoff";

const now = new Date("2030-01-01T10:00:00.000Z");
const recordingRow = {
  id: "recording-1",
  consultationId: "consultation-1",
  provider: "zoom" as const,
  providerRecordingId: "provider-file-1",
  fileType: "mp4",
  recordingType: "speaker_view",
  fileSizeBytes: BigInt(1024),
  consultation: { zoomMeetingId: "12345678901" }
};

describe("recording external-browser handoff", () => {
  let authRecord: Record<string, unknown> | null;

  beforeEach(() => {
    vi.clearAllMocks();
    authRecord = null;
    mocks.session = { userId: "doctor-1", role: "doctor" };
    mocks.cookieName = null;
    mocks.cookieValue = null;
    mocks.tx.user.findFirst.mockResolvedValue({ id: "doctor-1" });
    mocks.tx.consultationRecording.findFirst.mockResolvedValue(recordingRow);
    mocks.tx.authSession.create.mockImplementation(async ({ data }) => {
      authRecord = {
        ...data,
        user: { id: data.userId, role: mocks.session?.role ?? "doctor", status: "active" }
      };
      return authRecord;
    });
    mocks.tx.authSession.findUnique.mockImplementation(async () => authRecord);
    mocks.tx.authSession.updateMany.mockImplementation(async ({ where, data }) => {
      if (
        !authRecord ||
        authRecord.id !== where.id ||
        authRecord.userAgent !== where.userAgent ||
        authRecord.refreshTokenHash !== where.refreshTokenHash ||
        authRecord.status !== "active"
      ) {
        return { count: 0 };
      }
      authRecord = { ...authRecord, ...data };
      return { count: 1 };
    });
  });

  it("stores only a domain-separated hash for a two-minute one-time ticket", async () => {
    const handoff = await issueRecordingExternalHandoff(
      "consultation-1",
      "recording-1",
      "view",
      { now, ipAddress: "203.0.113.10" }
    );
    const stored = mocks.tx.authSession.create.mock.calls[0]?.[0].data;

    expect(handoff.ticket).toMatch(/^v1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{40,64}$/);
    expect(stored.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(handoff.ticket);
    expect(stored.userAgent).toMatch(/^recording-handoff-ticket:v1:doctor:[a-f0-9]{64}$/);
    expect(stored.userAgent).not.toContain("consultation-1");
    expect(stored.userAgent).not.toContain("recording-1");
    expect(stored.userAgent.length).toBeLessThanOrEqual(191);
    expect(stored.expiresAt.getTime() - now.getTime()).toBe(recordingExternalHandoffLimits.handoffTtlMs);
  });

  it("authorizes only an active admin or the assigned doctor for the exact recording", async () => {
    await issueRecordingExternalHandoff("consultation-1", "recording-1", "view", { now });
    expect(mocks.tx.consultationRecording.findFirst.mock.calls[0]?.[0].where).toMatchObject({
      id: "recording-1",
      consultationId: "consultation-1",
      consultation: { doctor: { userId: "doctor-1" } }
    });

    mocks.session = { userId: "admin-1", role: "admin" };
    await issueRecordingExternalHandoff("consultation-1", "recording-1", "download", { now });
    expect(mocks.tx.consultationRecording.findFirst.mock.calls[1]?.[0].where).not.toHaveProperty("consultation");

    mocks.session = { userId: "customer-1", role: "customer" };
    await expect(
      issueRecordingExternalHandoff("consultation-1", "recording-1", "view", { now })
    ).rejects.toBeInstanceOf(RecordingExternalHandoffError);

    mocks.session = { userId: "doctor-2", role: "doctor" };
    mocks.tx.consultationRecording.findFirst.mockResolvedValueOnce(null);
    await expect(
      issueRecordingExternalHandoff("consultation-1", "recording-1", "view", { now })
    ).rejects.toBeInstanceOf(RecordingExternalHandoffError);

    mocks.tx.user.findFirst.mockResolvedValueOnce(null);
    await expect(
      issueRecordingExternalHandoff("consultation-1", "recording-1", "view", { now })
    ).rejects.toBeInstanceOf(RecordingExternalHandoffError);
  });

  it("exchanges once and rejects replay, expiry, and wrong consultation/recording/mode scopes", async () => {
    const handoff = await issueRecordingExternalHandoff("consultation-1", "recording-1", "view", { now });

    await expect(
      exchangeRecordingExternalHandoff(handoff.ticket, "consultation-2", "recording-1", "view", now)
    ).rejects.toBeInstanceOf(RecordingExternalHandoffError);
    await expect(
      exchangeRecordingExternalHandoff(handoff.ticket, "consultation-1", "recording-2", "view", now)
    ).rejects.toBeInstanceOf(RecordingExternalHandoffError);
    await expect(
      exchangeRecordingExternalHandoff(handoff.ticket, "consultation-1", "recording-1", "download", now)
    ).rejects.toBeInstanceOf(RecordingExternalHandoffError);

    const exchanged = await exchangeRecordingExternalHandoff(
      handoff.ticket,
      "consultation-1",
      "recording-1",
      "view",
      now
    );
    expect(exchanged.externalSessionToken).not.toBe(handoff.ticket);
    expect(authRecord?.userAgent).toMatch(/^recording-external-session:v1:doctor:[a-f0-9]{64}:pending$/);
    expect(exchanged.expiresAt.getTime() - now.getTime()).toBe(recordingExternalHandoffLimits.externalSessionTtlMs);
    await expect(
      exchangeRecordingExternalHandoff(handoff.ticket, "consultation-1", "recording-1", "view", now)
    ).rejects.toBeInstanceOf(RecordingExternalHandoffError);

    const expired = await issueRecordingExternalHandoff("consultation-1", "recording-1", "view", { now });
    await expect(
      exchangeRecordingExternalHandoff(
        expired.ticket,
        "consultation-1",
        "recording-1",
        "view",
        new Date(now.getTime() + recordingExternalHandoffLimits.handoffTtlMs + 1)
      )
    ).rejects.toBeInstanceOf(RecordingExternalHandoffError);
  });

  it("rechecks active role and exact assignment on every external request", async () => {
    const handoff = await issueRecordingExternalHandoff("consultation-1", "recording-1", "download", { now });
    const exchanged = await exchangeRecordingExternalHandoff(
      handoff.ticket,
      "consultation-1",
      "recording-1",
      "download",
      now
    );
    mocks.cookieName = getRecordingExternalCookieName("download");
    mocks.cookieValue = exchanged.externalSessionToken;

    await expect(
      getRecordingExternalAccess("consultation-1", "recording-1", "download", now)
    ).resolves.toMatchObject({ mode: "download", viewer: { userId: "doctor-1", role: "doctor" } });
    await expect(
      getRecordingExternalAccess("consultation-1", "recording-1", "view", now)
    ).resolves.toBeNull();

    (authRecord?.user as { status: string }).status = "suspended";
    await expect(
      getRecordingExternalAccess("consultation-1", "recording-1", "download", now)
    ).resolves.toBeNull();
    (authRecord?.user as { status: string }).status = "active";
    mocks.tx.consultationRecording.findFirst.mockResolvedValueOnce(null);
    await expect(
      getRecordingExternalAccess("consultation-1", "recording-1", "download", now)
    ).resolves.toBeNull();
  });

  it("writes one logical access audit despite repeated range requests in one external session", async () => {
    const handoff = await issueRecordingExternalHandoff("consultation-1", "recording-1", "view", { now });
    const exchanged = await exchangeRecordingExternalHandoff(
      handoff.ticket,
      "consultation-1",
      "recording-1",
      "view",
      now
    );
    mocks.cookieName = getRecordingExternalCookieName("view");
    mocks.cookieValue = exchanged.externalSessionToken;
    const firstAccess = await getRecordingExternalAccess("consultation-1", "recording-1", "view", now);
    const secondAccess = await getRecordingExternalAccess("consultation-1", "recording-1", "view", now);

    await expect(auditExternalRecordingAccessOnce(firstAccess!, now)).resolves.toBe(true);
    await expect(auditExternalRecordingAccessOnce(secondAccess!, now)).resolves.toBe(false);
    expect(
      mocks.writeAuditLog.mock.calls.filter((call) => call[1].action === "consultation_recording.view")
    ).toHaveLength(1);
  });

  it("uses separate exact-path cookies for view and download", () => {
    const view = getRecordingExternalCookieOptions("consultation-1", "recording-1");
    expect(getRecordingExternalCookieName("view")).not.toBe(getRecordingExternalCookieName("download"));
    expect(view).toMatchObject({
      httpOnly: true,
      sameSite: "strict",
      path: "/api/consultations/consultation-1/recordings/recording-1",
      maxAge: 7200
    });
  });
});
