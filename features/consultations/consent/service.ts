import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import {
  isAtLeast18,
  TELEMEDICINE_CONSENT_SCOPE,
  TELEMEDICINE_CONSENT_VERSION,
  TELEMEDICINE_RECORDING_RETENTION_YEARS
} from "@/features/consultations/consent/policy";

export class TelemedicineConsentError extends Error {
  constructor(public readonly code: "REQUIRED" | "CURRENT_VERSION_REQUIRED" | "GUARDIAN_REQUIRED") {
    super(code);
    this.name = "TelemedicineConsentError";
  }
}

export function assertTelemedicineSelfConsent(input: {
  dateOfBirth: Date;
  accepted: string | undefined;
  version: string | undefined;
  now: Date;
}): void {
  if (!isAtLeast18(input.dateOfBirth, input.now)) {
    throw new TelemedicineConsentError("GUARDIAN_REQUIRED");
  }

  if (input.accepted !== "on") {
    throw new TelemedicineConsentError("REQUIRED");
  }

  if (input.version !== TELEMEDICINE_CONSENT_VERSION) {
    throw new TelemedicineConsentError("CURRENT_VERSION_REQUIRED");
  }
}

export async function createTelemedicineConsent(
  tx: Prisma.TransactionClient,
  input: {
    consultationId: string;
    userId: string;
    acceptedAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }
): Promise<string> {
  const consent = await tx.telemedicineConsent.create({
    data: {
      consultationId: input.consultationId,
      userId: input.userId,
      version: TELEMEDICINE_CONSENT_VERSION,
      acceptedAt: input.acceptedAt,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadataJson: {
        source: "customer_booking",
        scope: TELEMEDICINE_CONSENT_SCOPE,
        automaticRecording: true,
        retentionYears: TELEMEDICINE_RECORDING_RETENTION_YEARS,
        consentActor: "adult_patient"
      }
    },
    select: { id: true }
  });

  await writeAuditLog(tx, {
    actorId: input.userId,
    action: "telemedicine_consent.accept",
    entityType: "telemedicine_consent",
    entityId: consent.id,
    metadata: {
      consultationId: input.consultationId,
      version: TELEMEDICINE_CONSENT_VERSION,
      scope: TELEMEDICINE_CONSENT_SCOPE,
      automaticRecording: true,
      retentionYears: TELEMEDICINE_RECORDING_RETENTION_YEARS
    }
  });

  return consent.id;
}
