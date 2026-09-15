import { describe, expect, it, vi } from "vitest";
import { applyDoctorConsultationTransition } from "@/features/doctor/consultations/workflow-service";

const sensitiveFullName = "ชื่อที่ห้ามอยู่ใน audit";
const sensitiveNationalId = "1101700203450";

function consultation(patientOverrides: Record<string, unknown> = {}) {
  return {
    id: "consultation-1",
    patientId: "patient-1",
    status: "scheduled",
    scheduledAt: new Date("2020-01-01T10:00:00.000Z"),
    attendanceEvents: [],
    doctor: {
      userId: "doctor-1",
      status: "approved",
      user: { status: "active" }
    },
    patient: {
      role: "customer",
      status: "active",
      fullName: sensitiveFullName,
      nationalId: sensitiveNationalId,
      dateOfBirth: new Date("1990-01-02T00:00:00.000Z"),
      phone: "0812345678",
      normalizedPhone: "+66812345678",
      phoneVerifiedAt: new Date("2029-01-01T00:00:00.000Z"),
      ...patientOverrides
    }
  };
}

function transaction(
  options: {
    patientOverrides?: Record<string, unknown>;
    actor?: { id: string; role: string; status: string } | null;
  } = {}
) {
  const revealCreatedAt = new Date(Date.now() - 1_000);
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    consultation: {
      findUnique: vi.fn().mockResolvedValue(consultation(options.patientOverrides)),
      update: vi.fn().mockResolvedValue({ id: "consultation-1" })
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(
        options.actor === undefined
          ? { id: "doctor-1", role: "doctor", status: "active" }
          : options.actor
      )
    },
    notification: { create: vi.fn().mockResolvedValue({ id: "notification-1" }) },
    auditLog: {
      findFirst: vi.fn().mockImplementation(({ where }) =>
        where.action === "profile.identity.update" ? null : { createdAt: revealCreatedAt }
      ),
      create: vi.fn().mockResolvedValue({ id: "audit-1" })
    }
  };
}

const startInput = {
  consultationId: "consultation-1",
  transition: "start" as const,
  actorId: "doctor-1",
  actorRole: "doctor" as const,
  identityConfirmed: true
};

describe("doctor start identity transaction gate", () => {
  it("rechecks complete verified identity after locking and starts once", async () => {
    const tx = transaction();

    await applyDoctorConsultationTransition(tx as never, startInput);

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.user.findUnique).toHaveBeenCalledWith({
      where: { id: "doctor-1" },
      select: { id: true, role: true, status: true }
    });
    expect(tx.consultation.update).toHaveBeenCalledWith({
      where: { id: "consultation-1" },
      data: {
        status: "live",
        zoomMeetingId: undefined,
        zoomPassword: undefined,
        zoomJoinUrl: undefined
      }
    });

    const audit = tx.auditLog.create.mock.calls[0]?.[0]?.data;
    expect(audit.action).toBe("consultation.start");
    expect(audit.metadataJson).toMatchObject({
      identityConfirmed: true,
      identityStatus: "verified"
    });
    expect(JSON.stringify(audit)).not.toContain(sensitiveFullName);
    expect(JSON.stringify(audit)).not.toContain(sensitiveNationalId);
    expect(JSON.stringify(audit)).not.toContain("1990-01-02");
  });

  it.each([
    ["fullName", null],
    ["nationalId", null],
    ["dateOfBirth", null],
    ["phone", null],
    ["normalizedPhone", null],
    ["phoneVerifiedAt", null],
    ["status", "inactive"]
  ])("rejects incomplete or inactive patient field %s inside the transaction", async (field, value) => {
    const tx = transaction({ patientOverrides: { [field]: value } });

    await expect(
      applyDoctorConsultationTransition(tx as never, startInput)
    ).rejects.toMatchObject({ code: "patient_identity_incomplete" });
    expect(tx.consultation.update).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects a false confirmation inside the transaction", async () => {
    const tx = transaction();

    await expect(
      applyDoctorConsultationTransition(tx as never, {
        ...startInput,
        identityConfirmed: false
      })
    ).rejects.toMatchObject({ code: "identity_confirmation_required" });
    expect(tx.consultation.update).not.toHaveBeenCalled();
  });

  it("rejects a true flag when the reveal audit is missing inside the transaction", async () => {
    const tx = transaction();
    tx.auditLog.findFirst.mockResolvedValueOnce(null);

    await expect(
      applyDoctorConsultationTransition(tx as never, startInput)
    ).rejects.toMatchObject({ code: "identity_confirmation_required" });
    expect(tx.consultation.update).not.toHaveBeenCalled();
  });

  it("requires a fresh reveal when the patient updates legal identity after the reveal", async () => {
    const tx = transaction();
    tx.auditLog.findFirst
      .mockResolvedValueOnce({ createdAt: new Date("2030-01-01T00:00:00.000Z") })
      .mockResolvedValueOnce({ createdAt: new Date("2030-01-01T00:01:00.000Z") });

    await expect(
      applyDoctorConsultationTransition(tx as never, {
        ...startInput,
        now: new Date("2030-01-01T00:02:00.000Z")
      })
    ).rejects.toMatchObject({ code: "identity_confirmation_required" });
    expect(tx.auditLog.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        action: "profile.identity.update",
        entityType: "user",
        entityId: "patient-1",
        createdAt: { gte: new Date("2030-01-01T00:00:00.000Z") }
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    });
    expect(tx.consultation.update).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects an actor whose account became inactive before commit", async () => {
    const tx = transaction({
      actor: { id: "doctor-1", role: "doctor", status: "inactive" }
    });

    await expect(
      applyDoctorConsultationTransition(tx as never, startInput)
    ).rejects.toMatchObject({ code: "inactive_actor" });
    expect(tx.consultation.update).not.toHaveBeenCalled();
  });
});
