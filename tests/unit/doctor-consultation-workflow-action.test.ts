import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyTransition: vi.fn(),
  createZoomMeeting: vi.fn(),
  findUnique: vi.fn(),
  revalidatePath: vi.fn(),
  requireDoctorSession: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

vi.mock("@/lib/auth/guards", () => ({
  requireDoctorSession: mocks.requireDoctorSession
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    consultation: {
      findUnique: mocks.findUnique
    },
    $transaction: mocks.transaction
  }
}));

vi.mock("@/lib/zoom/meetings", () => ({
  createZoomMeetingIfConfigured: mocks.createZoomMeeting
}));

vi.mock("@/features/doctor/consultations/workflow-service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/doctor/consultations/workflow-service")
  >();

  return {
    ...actual,
    applyDoctorConsultationTransition: mocks.applyTransition
  };
});

import { transitionDoctorConsultationAction } from "@/features/doctor/consultations/workflow-actions";

function startFormData() {
  const formData = new FormData();
  formData.set("consultationId", "consultation-1");
  formData.set("transition", "start");
  return formData;
}

function scheduledConsultation(scheduledAt: Date) {
  return {
    id: "consultation-1",
    patientId: "patient-1",
    status: "scheduled",
    scheduledAt,
    zoomMeetingId: null,
    doctor: {
      userId: "doctor-user-1"
    }
  };
}

describe("transitionDoctorConsultationAction start gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.requireDoctorSession.mockResolvedValue({
      role: "doctor",
      userId: "doctor-user-1"
    });
    mocks.createZoomMeeting.mockResolvedValue(null);
    mocks.transaction.mockImplementation(async (operation: (tx: object) => Promise<unknown>) =>
      operation({})
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects an early start before Zoom creation or any transaction", async () => {
    vi.setSystemTime(new Date("2030-01-01T09:59:59.999Z"));
    mocks.findUnique.mockResolvedValue(
      scheduledConsultation(new Date("2030-01-01T10:00:00.000Z"))
    );

    const result = await transitionDoctorConsultationAction(
      { status: "idle", message: "" },
      startFormData()
    );

    expect(result).toEqual({
      status: "error",
      message: "ยังไม่ถึงเวลานัด ระบบจึงยังไม่เปิดให้เริ่มการปรึกษา"
    });
    expect(mocks.createZoomMeeting).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.applyTransition).not.toHaveBeenCalled();
  });

  it("starts at the appointment time and returns the live-room route", async () => {
    const scheduledAt = new Date("2030-01-01T10:00:00.000Z");
    vi.setSystemTime(scheduledAt);
    mocks.findUnique.mockResolvedValue(scheduledConsultation(scheduledAt));

    const result = await transitionDoctorConsultationAction(
      { status: "idle", message: "" },
      startFormData()
    );

    expect(result).toEqual({
      status: "success",
      message: "เริ่มการปรึกษาแล้ว ขณะนี้ใช้แชทในระบบเพราะยังไม่ได้ตั้งค่า Zoom",
      roomHref: "/consult/live?consultation=consultation-1"
    });
    expect(mocks.createZoomMeeting).toHaveBeenCalledTimes(1);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.applyTransition).toHaveBeenCalledTimes(1);
  });
});
