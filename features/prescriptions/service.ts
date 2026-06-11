import type { ConsultationStatus, PrescriptionStatus, Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import type { Role } from "@/lib/permissions/roles";

export type DoctorPrescriptionConsultation = {
  id: string;
  patientId: string;
  doctorId: string;
  status: ConsultationStatus;
  doctor: {
    userId: string;
  };
  prescriptions: Array<{
    id: string;
    status: PrescriptionStatus;
  }>;
};

export type DoctorPrescriptionWritePlan =
  | {
      mode: "create";
    }
  | {
      mode: "update";
      prescriptionId: string;
      previousStatus: PrescriptionStatus;
    };

const prescriptionReadyConsultationStatuses: ConsultationStatus[] = ["scheduled", "live", "completed"];
const updatablePrescriptionStatuses: PrescriptionStatus[] = ["draft", "rejected"];

export function assertConsultationReadyForPrescription(status: ConsultationStatus) {
  if (!prescriptionReadyConsultationStatuses.includes(status)) {
    throw new Error("Consultation is not ready for prescription writing.");
  }
}

export function getDoctorPrescriptionWritePlan(
  consultation: DoctorPrescriptionConsultation | null,
  actor: {
    role: Role;
    userId: string;
  }
): DoctorPrescriptionWritePlan {
  if (!consultation) {
    throw new Error("Consultation not found.");
  }

  if (actor.role === "doctor" && consultation.doctor.userId !== actor.userId) {
    throw new Error("Doctor cannot update another doctor's consultation.");
  }

  assertConsultationReadyForPrescription(consultation.status);

  const latestPrescription = consultation.prescriptions[0] ?? null;

  if (!latestPrescription) {
    return {
      mode: "create"
    };
  }

  if (updatablePrescriptionStatuses.includes(latestPrescription.status)) {
    return {
      mode: "update",
      prescriptionId: latestPrescription.id,
      previousStatus: latestPrescription.status
    };
  }

  throw new Error("Consultation already has an active prescription.");
}

export async function issueDoctorPrescription(
  tx: Prisma.TransactionClient,
  input: {
    consultationId: string;
    notes: string;
    actorId: string;
    actorRole: Role;
  }
) {
  const issuedAt = new Date();
  const consultation = await tx.consultation.findUnique({
    where: {
      id: input.consultationId
    },
    select: {
      id: true,
      patientId: true,
      doctorId: true,
      status: true,
      doctor: {
        select: {
          userId: true
        }
      },
      prescriptions: {
        orderBy: {
          updatedAt: "desc"
        },
        take: 1,
        select: {
          id: true,
          status: true
        }
      }
    }
  });

  if (!consultation) {
    throw new Error("Consultation not found.");
  }

  const plan = getDoctorPrescriptionWritePlan(consultation, {
    role: input.actorRole,
    userId: input.actorId
  });
  const prescriptionId =
    plan.mode === "update"
      ? await updateExistingDoctorPrescription(tx, {
          consultation,
          plan,
          notes: input.notes,
          issuedAt,
          actorId: input.actorId
        })
      : await createDoctorPrescription(tx, {
          consultation,
          notes: input.notes,
          issuedAt,
          actorId: input.actorId
        });

  await tx.notification.create({
    data: {
      userId: consultation.patientId,
      type: "prescription",
      channel: "in_app",
      title: "แพทย์ออกใบสั่งยาแล้ว",
      body: "คุณสามารถใช้ใบสั่งยานี้สั่งซื้อสินค้าที่ต้องใช้ใบสั่งยาได้ โดยไม่ต้องรอขั้นตอนตรวจเอกสารซ้ำ",
      metadataJson: {
        consultationId: consultation.id,
        prescriptionId,
        href: "/consult/prescriptions"
      }
    }
  });
}

async function updateExistingDoctorPrescription(
  tx: Prisma.TransactionClient,
  input: {
    consultation: DoctorPrescriptionConsultation;
    plan: Extract<DoctorPrescriptionWritePlan, { mode: "update" }>;
    notes: string;
    issuedAt: Date;
    actorId: string;
  }
) {
  await tx.prescription.update({
    where: {
      id: input.plan.prescriptionId
    },
    data: {
      notes: input.notes,
      status: "verified",
      verifiedAt: input.issuedAt
    }
  });
  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: "prescription.doctor_issued",
    entityType: "prescription",
    entityId: input.plan.prescriptionId,
    metadata: {
      consultationId: input.consultation.id,
      patientId: input.consultation.patientId,
      previousStatus: input.plan.previousStatus,
      nextStatus: "verified",
      noAdditionalDocumentReview: true
    }
  });

  return input.plan.prescriptionId;
}

async function createDoctorPrescription(
  tx: Prisma.TransactionClient,
  input: {
    consultation: DoctorPrescriptionConsultation;
    notes: string;
    issuedAt: Date;
    actorId: string;
  }
) {
  const prescription = await tx.prescription.create({
    data: {
      consultationId: input.consultation.id,
      patientId: input.consultation.patientId,
      doctorId: input.consultation.doctorId,
      notes: input.notes,
      status: "verified",
      verifiedAt: input.issuedAt
    }
  });

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: "prescription.doctor_issued",
    entityType: "prescription",
    entityId: prescription.id,
    metadata: {
      consultationId: input.consultation.id,
      patientId: input.consultation.patientId,
      nextStatus: "verified",
      noAdditionalDocumentReview: true
    }
  });

  return prescription.id;
}
