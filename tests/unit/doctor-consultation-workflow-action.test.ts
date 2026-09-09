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

  it("rejects a start immediately before T-5 without Zoom creation or a transaction", async () => {
    vi.setSystemTime(new Date("2030-01-01T09:54:59.999Z"));
    mocks.findUnique.mockResolvedValue(
      scheduledConsultation(new Date("2030-01-01T10:00:00.000Z"))
    );

    const result = await transitionDoctorConsultationAction(
      { status: "idle", message: "" },
      startFormData()
    );

    expect(result).toEqual({
      status: "error",
      message: "เปิดห้องได้ก่อนเวลานัด 5 นาที กรุณารอจนถึงช่วงเวลาเตรียมห้อง"
    });
    expect(mocks.createZoomMeeting).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.applyTransition).not.toHaveBeenCalled();
  });

  it("starts exactly at T-5 and returns the live-room route", async () => {
    const scheduledAt = new Date("2030-01-01T10:00:00.000Z");
    vi.setSystemTime(new Date("2030-01-01T09:55:00.000Z"));
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
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable"
    });
    expect(mocks.applyTransition).toHaveBeenCalledTimes(1);
  });

  it("does not create another Zoom meeting when the consultation already has one", async () => {
    const scheduledAt = new Date("2030-01-01T10:00:00.000Z");
    vi.setSystemTime(new Date("2030-01-01T10:01:00.000Z"));
    mocks.findUnique.mockResolvedValue({
      ...scheduledConsultation(scheduledAt),
      zoomMeetingId: "existing-meeting"
    });

    const result = await transitionDoctorConsultationAction(
      { status: "idle", message: "" },
      startFormData()
    );

    expect(result).toMatchObject({
      status: "success",
      message: "เริ่มการปรึกษาและเปิดห้อง Zoom เดิมแล้ว"
    });
    expect(mocks.createZoomMeeting).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("does not transition to live when Zoom meeting creation fails", async () => {
    const scheduledAt = new Date("2030-01-01T10:00:00.000Z");
    vi.setSystemTime(new Date("2030-01-01T09:55:00.000Z"));
    mocks.findUnique.mockResolvedValue(scheduledConsultation(scheduledAt));
    mocks.createZoomMeeting.mockRejectedValue(new Error("zoom_unavailable"));

    const result = await transitionDoctorConsultationAction(
      { status: "idle", message: "" },
      startFormData()
    );

    expect(result).toEqual({
      status: "error",
      message: "ยังเริ่มการปรึกษาไม่ได้ กรุณาตรวจสถานะนัดและการตั้งค่า Zoom"
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.applyTransition).not.toHaveBeenCalled();
  });

  it("fails closed when the appointment time is missing", async () => {
    mocks.findUnique.mockResolvedValue({
      ...scheduledConsultation(new Date("2030-01-01T10:00:00.000Z")),
      scheduledAt: null
    });

    const result = await transitionDoctorConsultationAction(
      { status: "idle", message: "" },
      startFormData()
    );

    expect(result).toEqual({
      status: "error",
      message: "นัดหมายนี้ไม่มีเวลาเริ่มที่ยืนยันแล้ว กรุณาให้ทีมงานตรวจสอบก่อน"
    });
    expect(mocks.createZoomMeeting).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("blocks a doctor assigned to a different consultation before Zoom creation", async () => {
    vi.setSystemTime(new Date("2030-01-01T09:55:00.000Z"));
    mocks.findUnique.mockResolvedValue({
      ...scheduledConsultation(new Date("2030-01-01T10:00:00.000Z")),
      doctor: { userId: "doctor-user-2" }
    });

    const result = await transitionDoctorConsultationAction(
      { status: "idle", message: "" },
      startFormData()
    );

    expect(result.status).toBe("error");
    expect(mocks.createZoomMeeting).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("blocks a non-scheduled consultation before Zoom creation", async () => {
    vi.setSystemTime(new Date("2030-01-01T09:55:00.000Z"));
    mocks.findUnique.mockResolvedValue({
      ...scheduledConsultation(new Date("2030-01-01T10:00:00.000Z")),
      status: "completed"
    });

    const result = await transitionDoctorConsultationAction(
      { status: "idle", message: "" },
      startFormData()
    );

    expect(result.status).toBe("error");
    expect(mocks.createZoomMeeting).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
