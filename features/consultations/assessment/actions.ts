"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { submitConsultAssessmentSchema } from "@/features/consultations/assessment/schema";
import { durationLabels, getAssessmentRecommendation, symptomLabels } from "@/features/consultations/assessment/rules";

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function submitConsultAssessmentAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();
  assertPermission(session, "consultation:create:self");

  const parsed = submitConsultAssessmentSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    redirect("/consult/assessment/symptoms?assessment=invalid");
  }

  const completedAt = new Date();
  const expiresAt = new Date(completedAt);
  expiresAt.setDate(completedAt.getDate() + 7);

  if (session.userId.startsWith("dev:")) {
    redirect("/consult/assessment/complete");
  }

  const recommendation = getAssessmentRecommendation(parsed.data.symptom, parsed.data.duration);

  const assessment = await prisma.$transaction(async (tx) => {
    const record = await tx.consultAssessment.create({
      data: {
        userId: session.userId,
        symptom: parsed.data.symptom,
        symptomLabel: symptomLabels[parsed.data.symptom],
        duration: parsed.data.duration,
        durationLabel: durationLabels[parsed.data.duration],
        recommendationTopic: recommendation.topic,
        recommendationSpecialty: recommendation.specialty,
        recommendationReason: recommendation.reason,
        answersJson: {
          symptom: {
            value: parsed.data.symptom,
            label: symptomLabels[parsed.data.symptom]
          },
          duration: {
            value: parsed.data.duration,
            label: durationLabels[parsed.data.duration]
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

  redirect(`/consult/assessment/complete?assessment=${assessment.id}`);
}
