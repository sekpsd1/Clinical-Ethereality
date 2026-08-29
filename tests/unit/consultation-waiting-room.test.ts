import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWaitingRoomTiming } from "@/features/consultations/waiting-room/access";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  getCurrentSession: vi.fn(),
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

const { getConsultationWaitingRoom } = await import(
  "@/features/consultations/waiting-room/queries"
);

const scheduledAt = new Date("2030-01-01T10:00:00.000Z");

function consultationRecord(status: "scheduled" | "live" | "completed" = "scheduled") {
  return {
    id: "consultation-uat",
    status,
    scheduledAt,
    doctor: {
      user: {
        displayName: "Doctor UAT",
        avatarUrl: null
      }
    }
  };
}

function session(role: "customer" | "doctor" | "admin", userId: string) {
  return {
    userId,
    lineUserId: `line-${userId}`,
    role,
    expiresAt: "2030-01-01T12:00:00.000Z"
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getConsultationWaitingRoom", () => {
  it("denies anonymous and non-participant roles before a database read", async () => {
    mocks.getCurrentSession.mockResolvedValueOnce(null);

    await expect(getConsultationWaitingRoom("consultation-uat")).resolves.toBeNull();
    expect(mocks.findFirst).not.toHaveBeenCalled();

    mocks.getCurrentSession.mockResolvedValueOnce(session("admin", "admin-1"));

    await expect(getConsultationWaitingRoom("consultation-uat")).resolves.toBeNull();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("scopes customer access to the consultation owner and denies a cross-owner miss", async () => {
    mocks.getCurrentSession.mockResolvedValue(session("customer", "patient-1"));
    mocks.findFirst.mockResolvedValue(null);

    await expect(getConsultationWaitingRoom("consultation-uat")).resolves.toBeNull();
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "consultation-uat",
          patientId: "patient-1",
          status: { in: ["scheduled", "live"] }
        }
      })
    );
  });

  it("scopes doctor access to the assigned doctor", async () => {
    mocks.getCurrentSession.mockResolvedValue(session("doctor", "doctor-user-1"));
    mocks.findFirst.mockResolvedValue(consultationRecord("live"));

    const result = await getConsultationWaitingRoom(
      "consultation-uat",
      new Date("2029-12-31T00:00:00.000Z")
    );

    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "consultation-uat",
          doctor: { userId: "doctor-user-1" },
          status: { in: ["scheduled", "live"] }
        }
      })
    );
    expect(result).toMatchObject({
      viewerRole: "doctor",
      consultationStatus: "live",
      canEnterLive: true,
      liveHref: "/consult/live?consultation=consultation-uat"
    });
  });

  it("denies a doctor when the consultation is not assigned to that doctor", async () => {
    mocks.getCurrentSession.mockResolvedValue(session("doctor", "doctor-user-2"));
    mocks.findFirst.mockResolvedValue(null);

    await expect(getConsultationWaitingRoom("consultation-uat")).resolves.toBeNull();
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "consultation-uat",
          doctor: { userId: "doctor-user-2" },
          status: { in: ["scheduled", "live"] }
        }
      })
    );
  });

  it("fails closed for a wrong lifecycle status", async () => {
    mocks.getCurrentSession.mockResolvedValue(session("customer", "patient-1"));
    mocks.findFirst.mockResolvedValue(consultationRecord("completed"));

    await expect(getConsultationWaitingRoom("consultation-uat")).resolves.toBeNull();
  });

  it("shows an authorized scheduled room but withholds the live route before appointment time", async () => {
    mocks.getCurrentSession.mockResolvedValue(session("customer", "patient-1"));
    mocks.findFirst.mockResolvedValue(consultationRecord("scheduled"));

    const result = await getConsultationWaitingRoom(
      "consultation-uat",
      new Date("2030-01-01T09:59:00.000Z")
    );

    expect(result).toMatchObject({
      viewerRole: "customer",
      consultationStatus: "scheduled",
      canEnterLive: false,
      liveHref: null
    });
  });

  it("opens the server-authorized live route at appointment time", async () => {
    mocks.getCurrentSession.mockResolvedValue(session("customer", "patient-1"));
    mocks.findFirst.mockResolvedValue(consultationRecord("scheduled"));

    const result = await getConsultationWaitingRoom("consultation-uat", scheduledAt);

    expect(result).toMatchObject({
      consultationId: "consultation-uat",
      canEnterLive: true,
      liveHref: "/consult/live?consultation=consultation-uat"
    });
  });
});

describe("getWaitingRoomTiming", () => {
  it("enforces scheduled time and permits an already-live consultation", () => {
    expect(
      getWaitingRoomTiming(
        "scheduled",
        scheduledAt,
        new Date("2030-01-01T09:59:59.000Z")
      )
    ).toMatchObject({ canEnterLive: false, countdownValue: "00:01" });
    expect(getWaitingRoomTiming("scheduled", scheduledAt, scheduledAt)).toMatchObject({
      canEnterLive: true,
      countdownValue: "พร้อม"
    });
    expect(
      getWaitingRoomTiming("live", scheduledAt, new Date("2029-12-31T00:00:00.000Z"))
    ).toMatchObject({ canEnterLive: true, countdownValue: "พร้อม" });
  });
});
