import { describe, expect, it, vi } from "vitest";
import { applyDoctorConsultationTransition } from "@/features/doctor/consultations/workflow-service";

function event(
  role: "doctor" | "customer",
  eventType: "joined" | "left",
  occurredAt: string,
  participantSessionHash = `${role}-session`,
  meetingUuidHash = "meeting-a"
) {
  return {
    role,
    eventType,
    occurredAt: new Date(occurredAt),
    participantSessionHash,
    meetingUuidHash
  };
}

function transaction(attendanceEvents: ReturnType<typeof event>[]) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    consultation: {
      findUnique: vi.fn().mockResolvedValue({
        id: "consultation-1",
        patientId: "patient-1",
        status: "live",
        scheduledAt: new Date("2030-01-01T10:00:00.000Z"),
        attendanceEvents,
        doctor: { userId: "doctor-1" }
      }),
      update: vi.fn().mockResolvedValue({ id: "consultation-1" })
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: "notification-1" })
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" })
    }
  };
}

const doctorActor = {
  actorId: "doctor-1",
  actorRole: "doctor" as const
};

describe("doctor consultation attendance completion transaction", () => {
  it("denies normal completion until both parties have verified joins in one meeting", async () => {
    const tx = transaction([event("doctor", "joined", "2030-01-01T10:00:00.000Z")]);

    await expect(
      applyDoctorConsultationTransition(tx as never, {
        consultationId: "consultation-1",
        transition: "complete",
        summary: "คำแนะนำครบถ้วน",
        ...doctorActor
      })
    ).rejects.toMatchObject({ code: "attendance_not_verified" });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.consultation.update).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it("allows normal completion after Zoom verifies both parties in the same meeting", async () => {
    const tx = transaction([
      event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
      event("customer", "joined", "2030-01-01T10:01:00.000Z"),
      event("doctor", "left", "2030-01-01T10:02:00.000Z"),
      event("customer", "left", "2030-01-01T10:03:00.000Z")
    ]);

    await applyDoctorConsultationTransition(tx as never, {
      consultationId: "consultation-1",
      transition: "complete",
      summary: "คำแนะนำครบถ้วน",
      ...doctorActor
    });

    expect(tx.consultation.update).toHaveBeenCalledWith({
      where: { id: "consultation-1" },
      data: {
        status: "completed",
        summary: "คำแนะนำครบถ้วน",
        completionOutcome: "normal",
        noShowReason: null
      }
    });
    expect(tx.notification.create).toHaveBeenCalledOnce();
    expect(tx.auditLog.create.mock.calls[0]?.[0].data.action).toBe("consultation.complete");
  });

  it("denies normal completion when both parties joined the same meeting sequentially", async () => {
    const tx = transaction([
      event("customer", "left", "2030-01-01T10:08:00.000Z"),
      event("doctor", "left", "2030-01-01T10:05:00.000Z"),
      event("customer", "joined", "2030-01-01T10:06:00.000Z"),
      event("doctor", "joined", "2030-01-01T10:00:00.000Z")
    ]);

    await expect(
      applyDoctorConsultationTransition(tx as never, {
        consultationId: "consultation-1",
        transition: "complete",
        summary: "คำแนะนำครบถ้วน",
        ...doctorActor
      })
    ).rejects.toMatchObject({ code: "attendance_not_verified" });
    expect(tx.consultation.update).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it("denies no-show when the verified continuous doctor interval is under ten minutes", async () => {
    const tx = transaction([
      event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
      event("doctor", "left", "2030-01-01T10:09:59.000Z")
    ]);

    await expect(
      applyDoctorConsultationTransition(tx as never, {
        consultationId: "consultation-1",
        transition: "complete_no_show",
        noShowReason: "customer_did_not_join",
        ...doctorActor
      })
    ).rejects.toMatchObject({ code: "no_show_not_eligible" });
    expect(tx.consultation.update).not.toHaveBeenCalled();
  });

  it("records no-show without clinical advice after a verified ten-minute interval", async () => {
    const tx = transaction([
      event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
      event("doctor", "left", "2030-01-01T10:10:00.000Z")
    ]);

    await applyDoctorConsultationTransition(tx as never, {
      consultationId: "consultation-1",
      transition: "complete_no_show",
      noShowReason: "customer_did_not_join",
      ...doctorActor
    });

    expect(tx.consultation.update).toHaveBeenCalledWith({
      where: { id: "consultation-1" },
      data: {
        status: "completed",
        completionOutcome: "no_show",
        noShowReason: "customer_did_not_join"
      }
    });
    expect(JSON.stringify(tx.consultation.update.mock.calls[0]?.[0])).not.toContain("summary");
    expect(tx.auditLog.create.mock.calls[0]?.[0].data.action).toBe("consultation.no_show_complete");
    expect(tx.auditLog.create.mock.calls[0]?.[0].data.actorId).toBe("doctor-1");
    expect(tx.notification.create.mock.calls[0]?.[0].data.body).toContain("ระบบไม่พบการเข้าร่วมของคุณ");
  });

  it("denies no-show permanently after any verified customer join", async () => {
    const tx = transaction([
      event("doctor", "joined", "2030-01-01T10:00:00.000Z", "doctor-one", "meeting-a"),
      event("doctor", "left", "2030-01-01T10:10:00.000Z", "doctor-one", "meeting-a"),
      event("customer", "joined", "2030-01-01T10:11:00.000Z", "customer-one", "meeting-b")
    ]);

    await expect(
      applyDoctorConsultationTransition(tx as never, {
        consultationId: "consultation-1",
        transition: "complete_no_show",
        noShowReason: "customer_did_not_join",
        ...doctorActor
      })
    ).rejects.toMatchObject({ code: "no_show_not_eligible" });
  });

  it("does not let an admin claim the assigned doctor's no-show outcome", async () => {
    const tx = transaction([
      event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
      event("doctor", "left", "2030-01-01T10:10:00.000Z")
    ]);

    await expect(
      applyDoctorConsultationTransition(tx as never, {
        consultationId: "consultation-1",
        transition: "complete_no_show",
        noShowReason: "customer_did_not_join",
        actorId: "admin-1",
        actorRole: "admin"
      })
    ).rejects.toMatchObject({ code: "no_show_doctor_required" });
  });
});
