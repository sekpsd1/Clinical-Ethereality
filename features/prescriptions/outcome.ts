import type {
  ConsultationPrescriptionOutcomeStatus,
  ConsultationStatus,
  PrescriptionStatus,
  Prisma
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import type { Role } from "@/lib/permissions/roles";

export const prescriptionOutcomeLabels: Record<ConsultationPrescriptionOutcomeStatus, string> = {
  pending_doctor_summary: "รอแพทย์สรุป",
  prescription_issued: "มีใบสั่งยา",
  no_prescription: "ไม่มีใบสั่งยา"
};

export const prescriptionIssuedStatuses: PrescriptionStatus[] = [
  "pending_verification",
  "verified",
  "dispensed",
  "archived"
];

export type ConsultationPrescriptionOutcomeRecord = {
  id: string;
  status: ConsultationStatus;
  prescriptionOutcomeStatus: ConsultationPrescriptionOutcomeStatus;
  doctor: {
    userId: string;
  };
  prescriptions: Array<{
    id: string;
    status: PrescriptionStatus;
  }>;
};

export class ConsultationPrescriptionOutcomeError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "forbidden"
      | "invalid_lifecycle"
      | "missing_active_prescription"
      | "active_prescription_conflict"
      | "concurrent_update"
  ) {
    super(code);
  }
}

export function hasActivePrescription(
  prescriptions: ConsultationPrescriptionOutcomeRecord["prescriptions"]
): boolean {
  return prescriptions.some((prescription) =>
    prescriptionIssuedStatuses.includes(prescription.status)
  );
}

export function assertConsultationPrescriptionOutcomeTransition(
  consultation: ConsultationPrescriptionOutcomeRecord | null,
  nextStatus: ConsultationPrescriptionOutcomeStatus,
  actor: {
    role: Role;
    userId: string;
  }
): asserts consultation is ConsultationPrescriptionOutcomeRecord {
  if (!consultation) {
    throw new ConsultationPrescriptionOutcomeError("not_found");
  }

  if (actor.role !== "doctor" || consultation.doctor.userId !== actor.userId) {
    throw new ConsultationPrescriptionOutcomeError("forbidden");
  }

  if (consultation.status !== "completed") {
    throw new ConsultationPrescriptionOutcomeError("invalid_lifecycle");
  }

  const activePrescription = hasActivePrescription(consultation.prescriptions);

  if (nextStatus === "prescription_issued" && !activePrescription) {
    throw new ConsultationPrescriptionOutcomeError("missing_active_prescription");
  }

  if (nextStatus !== "prescription_issued" && activePrescription) {
    throw new ConsultationPrescriptionOutcomeError("active_prescription_conflict");
  }
}

export async function setConsultationPrescriptionOutcome(
  tx: Prisma.TransactionClient,
  input: {
    consultationId: string;
    nextStatus: ConsultationPrescriptionOutcomeStatus;
    actorId: string;
    actorRole: Role;
  }
): Promise<void> {
  const consultation = await tx.consultation.findUnique({
    where: {
      id: input.consultationId
    },
    select: {
      id: true,
      status: true,
      prescriptionOutcomeStatus: true,
      doctor: {
        select: {
          userId: true
        }
      },
      prescriptions: {
        select: {
          id: true,
          status: true
        }
      }
    }
  });

  assertConsultationPrescriptionOutcomeTransition(consultation, input.nextStatus, {
    role: input.actorRole,
    userId: input.actorId
  });

  if (consultation.prescriptionOutcomeStatus === input.nextStatus) {
    return;
  }

  const activePrescriptionFilter = {
    status: {
      in: prescriptionIssuedStatuses
    }
  } as const;
  const result = await tx.consultation.updateMany({
    where: {
      id: consultation.id,
      status: "completed",
      prescriptionOutcomeStatus: consultation.prescriptionOutcomeStatus,
      prescriptions:
        input.nextStatus === "prescription_issued"
          ? { some: activePrescriptionFilter }
          : { none: activePrescriptionFilter }
    },
    data: {
      prescriptionOutcomeStatus: input.nextStatus,
      prescriptionOutcomeUpdatedAt: new Date()
    }
  });

  if (result.count !== 1) {
    throw new ConsultationPrescriptionOutcomeError("concurrent_update");
  }

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: "consultation.prescription_outcome_updated",
    entityType: "consultation",
    entityId: consultation.id,
    metadata: {
      previousStatus: consultation.prescriptionOutcomeStatus,
      nextStatus: input.nextStatus
    }
  });
}
