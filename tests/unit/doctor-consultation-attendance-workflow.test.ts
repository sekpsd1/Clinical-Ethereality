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

function transaction(
  attendanceEvents: ReturnType<typeof event>[],
  options: {
    bookedDurationMinutes?: number | null;
    status?: "live" | "completed";
    actorStatus?: "active" | "suspended";
  } = {}
) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    consultation: {
      findUnique: vi.fn().mockResolvedValue({
        id: "consultation-1",
        patientId: "patient-1",
        status: options.status ?? "live",
        scheduledAt: new Date("2030-01-01T10:00:00.000Z"),
        bookedDurationMinutes: options.bookedDurationMinutes === undefined ? 15 : options.bookedDurationMinutes,
        attendanceEvents,
        doctor: { userId: "doctor-1", status: "approved", user: { status: "active" } }
      }),
      update: vi.fn().mockResolvedValue({ id: "consultation-1" })
    },
    user: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve({
          id: where.id,
          role: where.id === "admin-1" ? "admin" : where.id === "customer-1" ? "customer" : "doctor",
          status: options.actorStatus ?? "active"
        })
      )
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: "notification-1" })
    },
    auditLog: {
      findFirst: vi.fn().mockResolvedValue(null),
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

  it("allows normal completion after overlap and both leave before 15 minutes", async () => {
    const tx = transaction([
      event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
      event("customer", "joined", "2030-01-01T10:01:00.000Z"),
      event("customer", "left", "2030-01-01T10:03:00.000Z"),
      event("doctor", "left", "2030-01-01T10:04:00.000Z")
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

  it("denies no-show when a 15-minute slot has only 14:59 of continuous presence", async () => {
    const tx = transaction([
      event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
      event("doctor", "left", "2030-01-01T10:14:59.000Z")
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

  it("records no-show without clinical advice after the full 15-minute interval", async () => {
    const tx = transaction([
      event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
      event("doctor", "left", "2030-01-01T10:15:00.000Z")
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
      event("doctor", "left", "2030-01-01T10:15:00.000Z", "doctor-one", "meeting-a"),
      event("customer", "joined", "2030-01-01T10:16:00.000Z", "customer-one", "meeting-b")
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
      event("doctor", "left", "2030-01-01T10:15:00.000Z")
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

  it("rejects a crafted normal completion while participants remain in the room", async () => {
    const tx = transaction([
      event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
      event("customer", "joined", "2030-01-01T10:01:00.000Z")
    ]);

    await expect(
      applyDoctorConsultationTransition(tx as never, {
        consultationId: "consultation-1",
        transition: "complete",
        summary: "พยายามข้ามเงื่อนไขการออกจากห้อง",
        now: new Date("2030-01-01T10:20:00.000Z"),
        ...doctorActor
      })
    ).rejects.toMatchObject({ code: "attendance_not_verified" });
    expect(tx.consultation.update).not.toHaveBeenCalled();
  });

  it.each([
    [30, "2030-01-01T10:30:00.000Z"],
    [45, "2030-01-01T10:45:00.000Z"],
    [60, "2030-01-01T11:00:00.000Z"],
    [null, "2030-01-01T10:30:00.000Z"]
  ] as const)("enforces stored or fallback duration %s in the transaction", async (duration, leftAt) => {
    const tx = transaction(
      [
        event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
        event("doctor", "left", leftAt)
      ],
      { bookedDurationMinutes: duration }
    );

    await applyDoctorConsultationTransition(tx as never, {
      consultationId: "consultation-1",
      transition: "complete_no_show",
      noShowReason: "customer_did_not_join",
      ...doctorActor
    });

    expect(tx.consultation.update).toHaveBeenCalledOnce();
  });

  it("rejects wrong-doctor and customer actors before any write", async () => {
    const events = [
      event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
      event("customer", "joined", "2030-01-01T10:01:00.000Z"),
      event("customer", "left", "2030-01-01T10:02:00.000Z"),
      event("doctor", "left", "2030-01-01T10:03:00.000Z")
    ];
    const wrongDoctorTx = transaction(events);
    const customerTx = transaction(events);

    await expect(
      applyDoctorConsultationTransition(wrongDoctorTx as never, {
        consultationId: "consultation-1",
        transition: "complete",
        summary: "แพทย์อื่นพยายามจบเคส",
        actorId: "doctor-2",
        actorRole: "doctor"
      })
    ).rejects.toMatchObject({ code: "wrong_doctor" });
    await expect(
      applyDoctorConsultationTransition(customerTx as never, {
        consultationId: "consultation-1",
        transition: "complete",
        summary: "พยายามจบจากบัญชีผู้ป่วย",
        actorId: "customer-1",
        actorRole: "customer"
      })
    ).rejects.toMatchObject({ code: "inactive_actor" });
    expect(wrongDoctorTx.consultation.update).not.toHaveBeenCalled();
    expect(customerTx.consultation.update).not.toHaveBeenCalled();
  });

  it("rejects an inactive doctor, invalid status, and repeated completion", async () => {
    const events = [
      event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
      event("doctor", "left", "2030-01-01T10:15:00.000Z")
    ];
    const inactiveTx = transaction(events, { actorStatus: "suspended" });
    const completedTx = transaction(events, { status: "completed" });

    await expect(
      applyDoctorConsultationTransition(inactiveTx as never, {
        consultationId: "consultation-1",
        transition: "complete_no_show",
        noShowReason: "customer_did_not_join",
        ...doctorActor
      })
    ).rejects.toMatchObject({ code: "inactive_actor" });
    await expect(
      applyDoctorConsultationTransition(completedTx as never, {
        consultationId: "consultation-1",
        transition: "complete_no_show",
        noShowReason: "customer_did_not_join",
        ...doctorActor
      })
    ).rejects.toMatchObject({ code: "invalid_status" });
    await expect(
      applyDoctorConsultationTransition(completedTx as never, {
        consultationId: "consultation-1",
        transition: "complete",
        summary: "ส่งคำสั่งซ้ำ",
        ...doctorActor
      })
    ).rejects.toMatchObject({ code: "invalid_status" });
    expect(inactiveTx.consultation.update).not.toHaveBeenCalled();
    expect(completedTx.consultation.update).not.toHaveBeenCalled();
  });

  it("audits only derived attendance duration and outcome values", async () => {
    const tx = transaction([
      event("doctor", "joined", "2030-01-01T10:00:00.000Z", "secret-doctor-session", "secret-meeting"),
      event("customer", "joined", "2030-01-01T10:01:00.000Z", "secret-customer-session", "secret-meeting"),
      event("customer", "left", "2030-01-01T10:03:00.000Z", "secret-customer-session", "secret-meeting"),
      event("doctor", "left", "2030-01-01T10:04:00.000Z", "secret-doctor-session", "secret-meeting")
    ]);

    await applyDoctorConsultationTransition(tx as never, {
      consultationId: "consultation-1",
      transition: "complete",
      summary: "บันทึกผลการปรึกษาครบถ้วน",
      ...doctorActor
    });

    const metadata = tx.auditLog.create.mock.calls[0]?.[0].data.metadataJson;
    expect(metadata).toMatchObject({
      completionOutcome: "normal",
      requiredDurationMinutes: 15,
      verifiedDoctorPresenceSeconds: 240
    });
    expect(JSON.stringify(metadata)).not.toMatch(/secret-|meetingUuid|participantSession|patientId/i);
  });
});
