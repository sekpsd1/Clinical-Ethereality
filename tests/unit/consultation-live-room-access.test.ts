import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  getCurrentSession: vi.fn(),
  isZoomMeetingSdkConfigured: vi.fn(),
  noStore: vi.fn()
}));

vi.mock("next/cache", () => ({ unstable_noStore: mocks.noStore }));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    consultation: {
      findFirst: mocks.findFirst
    }
  }
}));
vi.mock("@/lib/zoom/meeting-sdk", () => ({
  isZoomMeetingSdkConfigured: mocks.isZoomMeetingSdkConfigured
}));

const { getLiveConsultationChat } = await import("@/features/consultations/chat/queries");

const scheduledAt = new Date("2030-01-01T10:00:00.000Z");

function session(role: "customer" | "doctor" | "admin", userId: string) {
  return {
    userId,
    lineUserId: `line-${userId}`,
    role,
    displayName: role === "doctor" ? "Doctor UAT" : "Customer UAT",
    expiresAt: "2030-01-01T12:00:00.000Z"
  };
}

function consultationRecord(status: "scheduled" | "live" | "completed") {
  return {
    id: "consultation-uat",
    status,
    scheduledAt,
    zoomMeetingId: "zoom-meeting-uat",
    patient: {
      avatarUrl: null
    },
    doctor: {
      user: {
        displayName: "Doctor UAT",
        avatarUrl: null
      }
    },
    messages: []
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isZoomMeetingSdkConfigured.mockReturnValue(true);
});

describe("getLiveConsultationChat direct URL access", () => {
  it("denies anonymous, missing-ID, and admin requests before reading consultation data", async () => {
    mocks.getCurrentSession.mockResolvedValueOnce(null);
    await expect(getLiveConsultationChat("consultation-uat", scheduledAt)).resolves.toMatchObject({
      consultationId: null
    });

    mocks.getCurrentSession.mockResolvedValueOnce(session("customer", "patient-1"));
    await expect(getLiveConsultationChat(undefined, scheduledAt)).resolves.toMatchObject({
      consultationId: null
    });

    mocks.getCurrentSession.mockResolvedValueOnce(session("admin", "admin-1"));
    await expect(getLiveConsultationChat("consultation-uat", scheduledAt)).resolves.toMatchObject({
      consultationId: null
    });

    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("denies a scheduled consultation before the appointment gate", async () => {
    const beforeAppointment = new Date("2030-01-01T09:59:59.000Z");
    mocks.getCurrentSession.mockResolvedValue(session("customer", "patient-1"));
    mocks.findFirst.mockResolvedValue(consultationRecord("scheduled"));

    const result = await getLiveConsultationChat("consultation-uat", beforeAppointment);

    expect(result.consultationId).toBeNull();
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "consultation-uat",
          patientId: "patient-1",
          status: "live",
          scheduledAt: { lte: beforeAppointment }
        }
      })
    );
  });

  it("denies a completed consultation without exposing chat or video", async () => {
    mocks.getCurrentSession.mockResolvedValue(session("customer", "patient-1"));
    mocks.findFirst.mockResolvedValue(consultationRecord("completed"));

    const result = await getLiveConsultationChat("consultation-uat", scheduledAt);

    expect(result).toMatchObject({
      consultationId: null,
      canSend: false,
      videoHref: null,
      messages: []
    });
  });

  it("denies a cross-owner consultation miss", async () => {
    mocks.getCurrentSession.mockResolvedValue(session("customer", "patient-other"));
    mocks.findFirst.mockResolvedValue(null);

    const result = await getLiveConsultationChat("consultation-uat", scheduledAt);

    expect(result.consultationId).toBeNull();
    expect(mocks.findFirst.mock.calls[0]?.[0].where).toMatchObject({
      patientId: "patient-other",
      status: "live"
    });
  });

  it("permits the owning customer only after the live transition and appointment time", async () => {
    mocks.getCurrentSession.mockResolvedValue(session("customer", "patient-1"));
    mocks.findFirst.mockResolvedValue(consultationRecord("live"));

    const result = await getLiveConsultationChat("consultation-uat", scheduledAt);

    expect(result).toMatchObject({
      consultationId: "consultation-uat",
      viewerRole: "customer",
      statusLabel: "Live",
      canSend: true,
      videoHref: "/consult/live/zoom?consultation=consultation-uat"
    });
  });

  it("permits only the assigned doctor after the live transition and appointment time", async () => {
    mocks.getCurrentSession.mockResolvedValue(session("doctor", "doctor-user-1"));
    mocks.findFirst.mockResolvedValue(consultationRecord("live"));

    const result = await getLiveConsultationChat("consultation-uat", scheduledAt);

    expect(mocks.findFirst.mock.calls[0]?.[0].where).toMatchObject({
      doctor: { userId: "doctor-user-1" },
      status: "live",
      scheduledAt: { lte: scheduledAt }
    });
    expect(result).toMatchObject({
      consultationId: "consultation-uat",
      viewerRole: "doctor",
      canSend: true
    });
  });
});
