import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transactionClient = {
    consultation: { findFirst: vi.fn() },
    authSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn()
    },
    auditLog: { create: vi.fn() }
  };

  return {
    session: null as null | {
      userId: string;
      role: "customer" | "doctor" | "admin" | "pharmacist";
      displayName?: string | null;
    },
    cookieValue: null as string | null,
    transactionClient,
    transaction: vi.fn(async (callback: (tx: typeof transactionClient) => unknown) => callback(transactionClient))
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (mocks.cookieValue ? { value: mocks.cookieValue } : undefined)
  })
}));
vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: async () => mocks.session
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    consultation: mocks.transactionClient.consultation,
    authSession: mocks.transactionClient.authSession
  }
}));

import {
  exchangeZoomExternalHandoff,
  getZoomExternalViewer,
  issueZoomExternalHandoff,
  revokeCurrentZoomExternalSession,
  ZoomExternalHandoffError
} from "@/features/consultations/zoom/external-handoff";

const now = new Date("2030-01-01T10:01:00.000Z");
const duringDoctorEarlyStart = new Date("2030-01-01T09:56:00.000Z");
const consultation = {
  id: "consultation-1",
  zoomMeetingId: "12345678901"
};

describe("Zoom external-browser handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = {
      userId: "customer-1",
      role: "customer",
      displayName: "Customer"
    };
    mocks.cookieValue = null;
    mocks.transactionClient.consultation.findFirst.mockResolvedValue(consultation);
    mocks.transactionClient.authSession.updateMany.mockResolvedValue({ count: 1 });
  });

  it("stores only a hash for a short-lived ticket bound to the current customer and appointment", async () => {
    const handoff = await issueZoomExternalHandoff("consultation-1", {
      now,
      ipAddress: "203.0.113.10"
    });
    const stored = mocks.transactionClient.authSession.create.mock.calls[0]?.[0].data;

    expect(handoff.ticket).toMatch(/^v1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{40,64}$/);
    expect(stored).toMatchObject({
      userId: "customer-1",
      status: "active",
      userAgent: "zoom-handoff-ticket:v1:customer:consultation-1",
      ipAddress: "203.0.113.10"
    });
    expect(stored.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(handoff.ticket);
    expect(stored.expiresAt.getTime() - now.getTime()).toBe(2 * 60 * 1000);
    expect(mocks.transactionClient.consultation.findFirst.mock.calls[0]?.[0].where).toMatchObject({
      patientId: "customer-1",
      patient: { role: "customer", status: "active" },
      status: "live",
      scheduledAt: { lte: now }
    });
  });

  it("issues an external handoff to the assigned doctor during the five-minute early-start window", async () => {
    mocks.session = {
      userId: "doctor-1",
      role: "doctor",
      displayName: "Dr A"
    };

    const handoff = await issueZoomExternalHandoff("consultation-1", {
      now: duringDoctorEarlyStart
    });

    expect(handoff.ticket).toMatch(/^v1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{40,64}$/);
    expect(mocks.transactionClient.consultation.findFirst.mock.calls[0]?.[0].where).toMatchObject({
      doctor: {
        userId: "doctor-1",
        user: { role: "doctor", status: "active" }
      },
      status: "live",
      scheduledAt: { lte: new Date("2030-01-01T10:01:00.000Z") }
    });
    expect(mocks.transactionClient.authSession.create.mock.calls[0]?.[0].data).toMatchObject({
      userId: "doctor-1",
      userAgent: "zoom-handoff-ticket:v1:doctor:consultation-1"
    });
  });

  it("keeps the customer external handoff blocked until the scheduled time", async () => {
    mocks.transactionClient.consultation.findFirst.mockResolvedValue(null);

    await expect(
      issueZoomExternalHandoff("consultation-1", { now: duringDoctorEarlyStart })
    ).rejects.toBeInstanceOf(ZoomExternalHandoffError);

    expect(mocks.transactionClient.consultation.findFirst.mock.calls[0]?.[0].where).toMatchObject({
      patientId: "customer-1",
      status: "live",
      scheduledAt: { lte: duringDoctorEarlyStart }
    });
    expect(mocks.transactionClient.authSession.create).not.toHaveBeenCalled();
  });

  it("rejects non-participant roles before reading appointment data", async () => {
    mocks.session = { userId: "admin-1", role: "admin" };

    await expect(issueZoomExternalHandoff("consultation-1", { now })).rejects.toBeInstanceOf(
      ZoomExternalHandoffError
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("exchanges the ticket once and keeps the resulting cookie scoped to the same account, role, and appointment", async () => {
    let record: Record<string, unknown> | null = null;
    mocks.transactionClient.authSession.create.mockImplementation(async ({ data }) => {
      record = {
        ...data,
        user: {
          id: "customer-1",
          role: "customer",
          status: "active",
          displayName: "Customer"
        }
      };
      return record;
    });
    mocks.transactionClient.authSession.findUnique.mockImplementation(async () => record);
    mocks.transactionClient.authSession.updateMany.mockImplementation(async ({ data }) => {
      record = record ? { ...record, ...data } : record;
      return { count: 1 };
    });
    const handoff = await issueZoomExternalHandoff("consultation-1", { now });

    const exchanged = await exchangeZoomExternalHandoff(handoff.ticket, now);

    expect(exchanged).toMatchObject({ consultationId: "consultation-1", role: "customer" });
    expect(exchanged.externalSessionToken).not.toBe(handoff.ticket);
    expect(record).toMatchObject({
      userAgent: "zoom-external-session:v1:customer:consultation-1"
    });
    mocks.cookieValue = exchanged.externalSessionToken;
    await expect(getZoomExternalViewer("consultation-1", now)).resolves.toMatchObject({
      userId: "customer-1",
      role: "customer"
    });
    await expect(exchangeZoomExternalHandoff(handoff.ticket, now)).rejects.toBeInstanceOf(
      ZoomExternalHandoffError
    );
  });

  it("fails closed when the appointment owner no longer passes the live-room gate", async () => {
    mocks.transactionClient.consultation.findFirst.mockResolvedValue(null);

    await expect(issueZoomExternalHandoff("consultation-1", { now })).rejects.toBeInstanceOf(
      ZoomExternalHandoffError
    );
    expect(mocks.transactionClient.authSession.create).not.toHaveBeenCalled();
  });

  it("revokes only the current valid external Zoom session and writes a scoped audit record", async () => {
    let record: Record<string, unknown> | null = null;
    mocks.transactionClient.authSession.create.mockImplementation(async ({ data }) => {
      record = {
        ...data,
        user: {
          id: "customer-1",
          role: "customer",
          status: "active",
          displayName: "Customer"
        }
      };
      return record;
    });
    mocks.transactionClient.authSession.findUnique.mockImplementation(async () => record);
    mocks.transactionClient.authSession.updateMany.mockImplementation(async ({ data }) => {
      record = record ? { ...record, ...data } : record;
      return { count: 1 };
    });
    const handoff = await issueZoomExternalHandoff("consultation-1", { now });
    const exchanged = await exchangeZoomExternalHandoff(handoff.ticket, now);
    mocks.cookieValue = exchanged.externalSessionToken;

    await expect(revokeCurrentZoomExternalSession(now)).resolves.toEqual({
      revoked: true,
      consultationId: "consultation-1"
    });
    expect(record).toMatchObject({
      status: "revoked",
      revokedAt: now,
      userAgent: "zoom-external-session:v1:customer:consultation-1"
    });
    expect(mocks.transactionClient.auditLog.create).toHaveBeenLastCalledWith({
      data: {
        actorId: "customer-1",
        action: "consultation.zoom_external_session_revoked",
        entityType: "Consultation",
        entityId: "consultation-1",
        metadataJson: {
          role: "customer",
          reason: "browser_video_room_leave"
        }
      }
    });

    const auditCount = mocks.transactionClient.auditLog.create.mock.calls.length;
    await expect(revokeCurrentZoomExternalSession(now)).resolves.toEqual({ revoked: false });
    expect(mocks.transactionClient.auditLog.create).toHaveBeenCalledTimes(auditCount);
  });

  it("does not revoke a handoff ticket that has not become an external session", async () => {
    let record: Record<string, unknown> | null = null;
    mocks.transactionClient.authSession.create.mockImplementation(async ({ data }) => {
      record = {
        ...data,
        user: {
          id: "customer-1",
          role: "customer",
          status: "active",
          displayName: "Customer"
        }
      };
      return record;
    });
    mocks.transactionClient.authSession.findUnique.mockImplementation(async () => record);
    const handoff = await issueZoomExternalHandoff("consultation-1", { now });
    mocks.cookieValue = handoff.ticket;

    await expect(revokeCurrentZoomExternalSession(now)).resolves.toEqual({ revoked: false });
    expect(mocks.transactionClient.authSession.updateMany).not.toHaveBeenCalled();
    expect(mocks.transactionClient.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("does not report success or write a leave audit for an expired external session", async () => {
    let record: Record<string, unknown> | null = null;
    mocks.transactionClient.authSession.create.mockImplementation(async ({ data }) => {
      record = {
        ...data,
        user: {
          id: "customer-1",
          role: "customer",
          status: "active",
          displayName: "Customer"
        }
      };
      return record;
    });
    mocks.transactionClient.authSession.findUnique.mockImplementation(async () => record);
    mocks.transactionClient.authSession.updateMany.mockImplementation(async ({ data }) => {
      record = record ? { ...record, ...data } : record;
      return { count: 1 };
    });
    const handoff = await issueZoomExternalHandoff("consultation-1", { now });
    const exchanged = await exchangeZoomExternalHandoff(handoff.ticket, now);
    mocks.cookieValue = exchanged.externalSessionToken;
    const updateCount = mocks.transactionClient.authSession.updateMany.mock.calls.length;
    const auditCount = mocks.transactionClient.auditLog.create.mock.calls.length;
    const afterExpiry = new Date(exchanged.expiresAt.getTime() + 1);

    await expect(revokeCurrentZoomExternalSession(afterExpiry)).resolves.toEqual({ revoked: false });
    expect(mocks.transactionClient.authSession.updateMany).toHaveBeenCalledTimes(updateCount);
    expect(mocks.transactionClient.auditLog.create).toHaveBeenCalledTimes(auditCount);
  });
});
