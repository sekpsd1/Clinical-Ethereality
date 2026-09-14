import { Prisma } from "@prisma/client";
import type { PublicSession } from "@/lib/auth/types";
import { getPublicAppOrigin } from "@/lib/auth/line-oauth";
import { writeAuditLog } from "@/lib/audit/audit-log";

export type VerifiedPatientIdentity = {
  fullName: string;
  nationalId: string;
  dateOfBirth: string;
};

export type PatientIdentityRecord = {
  role: string;
  status: string;
  fullName: string | null;
  nationalId: string | null;
  dateOfBirth: Date | null;
  phone: string | null;
  normalizedPhone: string | null;
  phoneVerifiedAt: Date | null;
};

export class PatientIdentityAccessError extends Error {
  constructor(
    readonly code:
      | "not_found"
      | "access_denied"
      | "invalid_status"
      | "identity_incomplete"
  ) {
    super(code);
    this.name = "PatientIdentityAccessError";
  }
}

export function hasTrustedPatientIdentityOrigin(request: Request): boolean {
  const requestOrigin = request.headers.get("origin");

  if (!requestOrigin) {
    return false;
  }

  try {
    const expectedOrigin = getPublicAppOrigin(new URL(request.url).origin);
    return new URL(requestOrigin).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export function isCompleteVerifiedPatientIdentity(
  patient: PatientIdentityRecord | null | undefined
): patient is PatientIdentityRecord & {
  fullName: string;
  nationalId: string;
  dateOfBirth: Date;
  phone: string;
  normalizedPhone: string;
  phoneVerifiedAt: Date;
} {
  return Boolean(
    patient?.role === "customer" &&
      patient.status === "active" &&
      patient.fullName?.trim() &&
      patient.nationalId &&
      /^\d{13}$/.test(patient.nationalId) &&
      patient.dateOfBirth &&
      patient.phone?.trim() &&
      patient.normalizedPhone?.trim() &&
      patient.phoneVerifiedAt
  );
}

export async function getPatientIdentityForConsultation(
  tx: Prisma.TransactionClient,
  input: {
    consultationId: string;
    session: PublicSession;
  }
): Promise<VerifiedPatientIdentity> {
  const [actor, consultation] = await Promise.all([
    tx.user.findUnique({
      where: { id: input.session.userId },
      select: { id: true, role: true, status: true }
    }),
    tx.consultation.findUnique({
      where: { id: input.consultationId },
      select: {
        id: true,
        status: true,
        patientId: true,
        doctor: {
          select: {
            status: true,
            user: { select: { id: true, status: true } }
          }
        }
      }
    })
  ]);

  if (!consultation) {
    throw new PatientIdentityAccessError("not_found");
  }

  const actorIsActive = Boolean(
    actor &&
      actor.id === input.session.userId &&
      actor.role === input.session.role &&
      actor.status === "active"
  );
  const accessContext =
    input.session.role === "admin"
      ? "admin_support"
      : input.session.role === "doctor" &&
          consultation.doctor.user.id === input.session.userId &&
          consultation.doctor.user.status === "active" &&
          consultation.doctor.status === "approved"
        ? "assigned_doctor"
        : null;

  if (!actorIsActive || !accessContext) {
    throw new PatientIdentityAccessError("access_denied");
  }

  if (consultation.status !== "scheduled" && consultation.status !== "live") {
    throw new PatientIdentityAccessError("invalid_status");
  }

  const patient = await tx.user.findUnique({
    where: { id: consultation.patientId },
    select: {
      role: true,
      status: true,
      fullName: true,
      nationalId: true,
      dateOfBirth: true,
      phone: true,
      normalizedPhone: true,
      phoneVerifiedAt: true
    }
  });

  if (!isCompleteVerifiedPatientIdentity(patient)) {
    throw new PatientIdentityAccessError("identity_incomplete");
  }

  await writeAuditLog(tx, {
    actorId: input.session.userId,
    action: "consultation.patient_identity_view",
    entityType: "consultation",
    entityId: consultation.id,
    metadata: {
      actorRole: input.session.role,
      accessContext
    }
  });

  return {
    fullName: patient.fullName,
    nationalId: patient.nationalId,
    dateOfBirth: patient.dateOfBirth.toISOString().slice(0, 10)
  };
}
