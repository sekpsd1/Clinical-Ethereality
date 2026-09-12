"use server";

import { isIP } from "node:net";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { getAppEnv } from "@/lib/env/schema";
import {
  acceptConsultAssessmentHealthConsentSchema,
  submitConsultAssessmentSchema
} from "@/features/consultations/assessment/schema";
import { durationLabels, getAssessmentRecommendation, getAssessmentSymptomLabel } from "@/features/consultations/assessment/rules";
import {
  CONSULT_ASSESSMENT_HEALTH_CONSENT_VERSION,
  consultAssessmentHealthConsent
} from "@/features/consultations/assessment/consent";
import {
  getAssessmentCompletePath,
  getAssessmentConsentPath,
  getAssessmentSymptomsPath,
  normalizeAssessmentDoctorId
} from "@/features/consultations/assessment/routes";
import { getConsultAssessmentExpiresAt } from "@/features/consultations/assessment/validity";

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function getClientIp(headerStore: Headers): string | null {
  const forwardedFor = headerStore.get("x-forwarded-for");
  const candidate = forwardedFor?.split(",")[0]?.trim() || headerStore.get("x-real-ip")?.trim();
  return candidate && isIP(candidate) !== 0 ? candidate : null;
}

export async function acceptConsultAssessmentHealthConsentAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();

  if (!hasPermission(session, "consultation:create:self")) {
    redirect(getAssessmentRoleRedirectPath(session.role) as Route);
  }

  const parsed = acceptConsultAssessmentHealthConsentSchema.safeParse(formDataToObject(formData));
  const doctorId = normalizeAssessmentDoctorId(
    typeof formData.get("doctorId") === "string" ? (formData.get("doctorId") as string) : null
  );

  if (!parsed.success || parsed.data.version !== CONSULT_ASSESSMENT_HEALTH_CONSENT_VERSION) {
    redirect(`${getAssessmentConsentPath(doctorId)}${doctorId ? "&" : "?"}consent=required` as Route);
  }

  if (session.userId.startsWith("dev:")) {
    redirect(getAssessmentSymptomsPath(parsed.data.doctorId));
  }

  const headerStore = await headers();
  const acceptedAt = new Date();
  const ipAddress = getClientIp(headerStore);
  const userAgent = headerStore.get("user-agent");

  await prisma.$transaction(async (tx) => {
    const consent = await tx.consentRecord.upsert({
      where: {
        userId_type_version: {
          userId: session.userId,
          type: "health_data",
          version: CONSULT_ASSESSMENT_HEALTH_CONSENT_VERSION
        }
      },
      create: {
        userId: session.userId,
        type: "health_data",
        version: CONSULT_ASSESSMENT_HEALTH_CONSENT_VERSION,
        acceptedAt,
        ipAddress,
        userAgent,
        metadataJson: {
          title: consultAssessmentHealthConsent.title,
          source: "consult_assessment",
          purpose: "pre_consult_symptom_collection"
        }
      },
      update: {
        acceptedAt,
        revokedAt: null,
        ipAddress,
        userAgent,
        metadataJson: {
          title: consultAssessmentHealthConsent.title,
          source: "consult_assessment",
          purpose: "pre_consult_symptom_collection"
        }
      },
      select: {
        id: true
      }
    });

    await writeAuditLog(tx, {
      actorId: session.userId,
      action: "consent.accept",
      entityType: "consent_record",
      entityId: consent.id,
      metadata: {
        consentType: "health_data",
        version: CONSULT_ASSESSMENT_HEALTH_CONSENT_VERSION,
        source: "consult_assessment"
      }
    });
  });

  revalidatePath("/profile/settings");
  revalidatePath("/consult/assessment");
  revalidatePath("/admin/audit");

  redirect(getAssessmentSymptomsPath(parsed.data.doctorId));
}

export async function submitConsultAssessmentAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();

  if (!hasPermission(session, "consultation:create:self")) {
    redirect(getAssessmentRoleRedirectPath(session.role) as Route);
  }

  const parsed = submitConsultAssessmentSchema.safeParse(formDataToObject(formData));
  const doctorId = normalizeAssessmentDoctorId(
    typeof formData.get("doctorId") === "string" ? (formData.get("doctorId") as string) : null
  );

  if (!parsed.success) {
    const invalidPath = getAssessmentSymptomsPath(doctorId);
    redirect(`${invalidPath}${doctorId ? "&" : "?"}assessment=invalid` as Route);
  }

  const completedAt = new Date();
  const expiresAt = getConsultAssessmentExpiresAt(completedAt);

  if (session.userId.startsWith("dev:")) {
    redirect(getAssessmentCompletePath(parsed.data.doctorId));
  }

  const consent = await prisma.consentRecord.findUnique({
    where: {
      userId_type_version: {
        userId: session.userId,
        type: "health_data",
        version: CONSULT_ASSESSMENT_HEALTH_CONSENT_VERSION
      }
    },
    select: {
      id: true,
      revokedAt: true
    }
  });

  if (!consent || consent.revokedAt) {
    const consentPath = getAssessmentConsentPath(parsed.data.doctorId);
    redirect(`${consentPath}${parsed.data.doctorId ? "&" : "?"}consent=required` as Route);
  }

  const recommendation = getAssessmentRecommendation(parsed.data.symptom, parsed.data.duration);
  const symptomDetail = parsed.data.symptom === "other" ? parsed.data.symptomDetail : undefined;
  const symptomLabel = getAssessmentSymptomLabel(parsed.data.symptom, symptomDetail);

  const assessment = await prisma.$transaction(async (tx) => {
    const record = await tx.consultAssessment.create({
      data: {
        userId: session.userId,
        symptom: parsed.data.symptom,
        symptomLabel,
        duration: parsed.data.duration,
        durationLabel: durationLabels[parsed.data.duration],
        recommendationTopic: recommendation.topic,
        recommendationSpecialty: recommendation.specialty,
        recommendationReason: recommendation.reason,
        answersJson: {
          symptom: {
            value: parsed.data.symptom,
            label: symptomLabel,
            ...(symptomDetail ? { detail: symptomDetail } : {})
          },
          duration: {
            value: parsed.data.duration,
            label: durationLabels[parsed.data.duration]
          },
          consent: {
            type: "health_data",
            version: CONSULT_ASSESSMENT_HEALTH_CONSENT_VERSION
          }
        },
        completedAt,
        expiresAt
      },
      select: {
        id: true
      }
    });

    await writeAuditLog(tx, {
      actorId: session.userId,
      action: "consult_assessment.complete",
      entityType: "consult_assessment",
      entityId: record.id,
      metadata: {
        symptom: parsed.data.symptom,
        duration: parsed.data.duration,
        recommendationTopic: recommendation.topic,
        recommendationSpecialty: recommendation.specialty,
        consentVersion: CONSULT_ASSESSMENT_HEALTH_CONSENT_VERSION,
        expiresAt: expiresAt.toISOString()
      }
    });

    return record;
  });

  revalidatePath("/");
  revalidatePath("/consult");
  revalidatePath("/consult/assessment");
  revalidatePath("/consult/assessment/complete");
  revalidatePath("/doctor/consultations");
  revalidatePath("/admin/audit");

  redirect(getAssessmentCompletePath(parsed.data.doctorId, assessment.id));
}

function getAssessmentRoleRedirectPath(role: string): string {
  const env = getAppEnv();

  if (process.env.NODE_ENV !== "production" && env.ENABLE_DEV_AUTH_BYPASS) {
    return `/auth/line?next=${encodeURIComponent("/consult/assessment?retake=1")}&forceRoleSelect=1`;
  }

  if (role === "doctor") {
    return "/doctor/consultations";
  }

  if (role === "pharmacist") {
    return "/pharmacist/prescriptions";
  }

  if (role === "admin") {
    return "/admin";
  }

  return "/consult/assessment";
}
