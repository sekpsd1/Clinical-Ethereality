import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const auditFindFirst = vi.fn();
  const findUnique = vi.fn();
  const userFindUnique = vi.fn();
  const queryRaw = vi.fn();

  return {
    applyTransition: vi.fn(),
    auditFindFirst,
    createZoomMeeting: vi.fn(),
    findUnique,
    queryRaw,
    revalidatePath: vi.fn(),
    requireDoctorSession: vi.fn(),
    transaction: vi.fn(),
    transactionClient: {
      $queryRaw: queryRaw,
      consultation: { findUnique },
      user: { findUnique: userFindUnique },
      auditLog: { findFirst: auditFindFirst }
    },
    userFindUnique
  };
});

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
    user: {
      findUnique: mocks.userFindUnique
    },
    auditLog: {
      findFirst: mocks.auditFindFirst
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
import { DoctorConsultationWorkflowError } from "@/features/doctor/consultations/workflow-service";

function startFormData(identityConfirmed: "true" | "false" | null = "true") {
  const formData = new FormData();
  formData.set("consultationId", "consultation-1");
  formData.set("transition", "start");
  if (identityConfirmed !== null) {
    formData.set("identityConfirmed", identityConfirmed);
  }
  return formData;
}

function completeFormData() {
  const formData = new FormData();
  formData.set("consultationId", "consultation-1");
  formData.set("transition", "complete");
  formData.set("summary", "สรุปคำแนะนำครบถ้วน");
  return formData;
}

function scheduledConsultation(scheduledAt: Date) {
  return {
    id: "consultation-1",
    patientId: "patient-1",
    status: "scheduled",
    scheduledAt,
    bookedDurationMinutes: 15,
    zoomMeetingId: null,
    doctor: {
      userId: "doctor-user-1",
      status: "approved",
      user: { status: "active" }
    },
    patient: {
      role: "customer",
      status: "active",
      fullName: "Patient Example",
      nationalId: "1101700203450",
      dateOfBirth: new Date("1990-01-02T00:00:00.000Z"),
      phone: "0812345678",
      normalizedPhone: "+66812345678",
      phoneVerifiedAt: new Date("2029-01-01T00:00:00.000Z")
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
    mocks.auditFindFirst.mockImplementation(async (input: { where?: { action?: string } }) =>
      input.where?.action === "profile.identity.update" ? null : { createdAt: new Date() }
    );
    mocks.userFindUnique.mockResolvedValue({
      id: "doctor-user-1",
      role: "doctor",
      status: "active"
    });
    mocks.transaction.mockImplementation(async (operation: (tx: object) => Promise<unknown>) =>
      operation(mocks.transactionClient)
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
    expect(mocks.transaction).toHaveBeenCalledOnce();
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
    expect(mocks.createZoomMeeting).toHaveBeenCalledWith({
      consultationId: "consultation-1",
      scheduledAt,
      bookedDurationMinutes: 15
    });
    expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ bookedDurationMinutes: true })
    }));
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
      maxWait: 5_000,
      timeout: 40_000
    });
    expect(mocks.applyTransition).toHaveBeenCalledTimes(1);
    expect(mocks.applyTransition).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ identityConfirmed: true })
    );
  });

  it("creates one Zoom meeting under the consultation lock and continues directly to handoff", async () => {
    const scheduledAt = new Date("2030-01-01T10:00:00.000Z");
    vi.setSystemTime(new Date("2030-01-01T09:55:00.000Z"));
    mocks.findUnique.mockResolvedValue(scheduledConsultation(scheduledAt));
    mocks.createZoomMeeting.mockResolvedValue({
      meetingId: "zoom-meeting-1",
      password: "pass",
      joinUrl: "https://zoom.example/join"
    });

    const result = await transitionDoctorConsultationAction(
      { status: "idle", message: "" },
      startFormData()
    );

    expect(result).toEqual({
      status: "success",
      message: "เริ่มการปรึกษาและสร้างห้อง Zoom แล้ว กำลังเปิดเบราว์เซอร์ภายนอก...",
      launchConsultationId: "consultation-1"
    });
    expect(mocks.queryRaw).toHaveBeenCalledOnce();
    expect(mocks.createZoomMeeting).toHaveBeenCalledOnce();
    expect(mocks.applyTransition).toHaveBeenCalledOnce();
    expect(mocks.queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createZoomMeeting.mock.invocationCallOrder[0]
    );
  });

  it.each([
    ["missing", null],
    ["false", "false" as const]
  ])("rejects %s identity confirmation before any read or Zoom creation", async (_label, value) => {
    const result = await transitionDoctorConsultationAction(
      { status: "idle", message: "" },
      startFormData(value)
    );

    expect(result).toEqual({
      status: "error",
      message: "กรุณาเปิดข้อมูลและยืนยันตัวตนกับผู้ป่วยก่อนเริ่มการปรึกษา"
    });
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.createZoomMeeting).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("blocks incomplete patient identity before Zoom creation", async () => {
    vi.setSystemTime(new Date("2030-01-01T09:55:00.000Z"));
    mocks.findUnique.mockResolvedValue({
      ...scheduledConsultation(new Date("2030-01-01T10:00:00.000Z")),
      patient: {
        ...scheduledConsultation(new Date("2030-01-01T10:00:00.000Z")).patient,
        phoneVerifiedAt: null
      }
    });

    const result = await transitionDoctorConsultationAction(
      { status: "idle", message: "" },
      startFormData()
    );

    expect(result).toEqual({
      status: "error",
      message: "ข้อมูลยืนยันตัวตนยังไม่ครบ กรุณาให้ลูกค้ายืนยันตัวตนก่อน"
    });
    expect(mocks.createZoomMeeting).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("blocks a crafted true flag when this actor did not reveal identity recently", async () => {
    vi.setSystemTime(new Date("2030-01-01T09:55:00.000Z"));
    mocks.findUnique.mockResolvedValue(
      scheduledConsultation(new Date("2030-01-01T10:00:00.000Z"))
    );
    mocks.auditFindFirst.mockResolvedValue(null);

    const result = await transitionDoctorConsultationAction(
      { status: "idle", message: "" },
      startFormData("true")
    );

    expect(result).toEqual({
      status: "error",
      message: "กรุณาเปิดข้อมูลและยืนยันตัวตนกับผู้ป่วยก่อนเริ่มการปรึกษา"
    });
    expect(mocks.createZoomMeeting).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("requires a fresh reveal when the customer corrected legal identity before Zoom creation", async () => {
    vi.setSystemTime(new Date("2030-01-01T09:55:00.000Z"));
    mocks.findUnique.mockResolvedValue(
      scheduledConsultation(new Date("2030-01-01T10:00:00.000Z"))
    );
    mocks.auditFindFirst
      .mockResolvedValueOnce({ createdAt: new Date("2030-01-01T09:54:00.000Z") })
      .mockResolvedValueOnce({ createdAt: new Date("2030-01-01T09:54:30.000Z") });

    const result = await transitionDoctorConsultationAction(
      { status: "idle", message: "" },
      startFormData("true")
    );

    expect(result).toEqual({
      status: "error",
      message: "กรุณาเปิดข้อมูลและยืนยันตัวตนกับผู้ป่วยก่อนเริ่มการปรึกษา"
    });
    expect(mocks.createZoomMeeting).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledOnce();
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
      message: "ใช้ห้อง Zoom เดิมแล้ว กำลังเปิดเบราว์เซอร์ภายนอก...",
      launchConsultationId: "consultation-1"
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
    expect(mocks.transaction).toHaveBeenCalledOnce();
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
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("blocks a doctor assigned to a different consultation before Zoom creation", async () => {
    vi.setSystemTime(new Date("2030-01-01T09:55:00.000Z"));
    mocks.findUnique.mockResolvedValue({
      ...scheduledConsultation(new Date("2030-01-01T10:00:00.000Z")),
      doctor: {
        userId: "doctor-user-2",
        status: "approved",
        user: { status: "active" }
      }
    });

    const result = await transitionDoctorConsultationAction(
      { status: "idle", message: "" },
      startFormData()
    );

    expect(result.status).toBe("error");
    expect(mocks.createZoomMeeting).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledOnce();
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
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("reuses a live consultation and meeting without duplicate creation or workflow writes", async () => {
    vi.setSystemTime(new Date("2030-01-01T10:01:00.000Z"));
    mocks.findUnique.mockResolvedValue({
      ...scheduledConsultation(new Date("2030-01-01T10:00:00.000Z")),
      status: "live",
      zoomMeetingId: "existing-meeting"
    });

    const result = await transitionDoctorConsultationAction(
      { status: "idle", message: "" },
      startFormData()
    );

    expect(result).toMatchObject({
      status: "success",
      launchConsultationId: "consultation-1"
    });
    expect(mocks.createZoomMeeting).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.applyTransition).not.toHaveBeenCalled();
  });

  it("returns the both-left attendance reason when a crafted completion request fails server verification", async () => {
    mocks.findUnique.mockResolvedValue({
      ...scheduledConsultation(new Date("2030-01-01T10:00:00.000Z")),
      status: "live",
      zoomMeetingId: "existing-meeting"
    });
    mocks.applyTransition.mockRejectedValue(
      new DoctorConsultationWorkflowError(
        "Doctor and customer Zoom attendance is not verified as overlapping and fully exited.",
        "attendance_not_verified"
      )
    );

    const result = await transitionDoctorConsultationAction(
      { status: "idle", message: "" },
      completeFormData()
    );

    expect(result).toEqual({
      status: "error",
      message: "ยังจบการปรึกษาไม่ได้ ต้องมีหลักฐานว่าแพทย์และผู้ป่วยเคยอยู่พร้อมกันในห้อง Zoom เดียวกัน และออกจากห้องครบทั้งสองฝ่าย"
    });
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.createZoomMeeting).not.toHaveBeenCalled();
  });
});
