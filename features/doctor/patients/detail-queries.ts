import type { Prisma } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { requireDoctorSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { prisma } from "@/lib/db/prisma";
import { getDoctorPatientReference } from "@/features/doctor/patient-reference";
import { formatPrescriptionItem, parsePrescriptionItems } from "@/features/prescriptions/items";
import type {
  DoctorAssessmentAnswer,
  DoctorPatientConsultationDetail,
  DoctorPatientDetailData
} from "@/features/doctor/patients/detail-types";

const consultationStatusLabels = {
  cancelled: "ยกเลิกแล้ว",
  completed: "เสร็จสิ้น",
  live: "กำลังปรึกษา",
  pending_payment: "รอชำระเงิน",
  requested: "รอยืนยัน",
  scheduled: "นัดหมายแล้ว"
} as const;

async function getDoctorScope(userId: string, role: string): Promise<string | null | undefined> {
  if (role === "admin") {
    return undefined;
  }

  const doctor = await prisma.doctor.findUnique({
    where: {
      userId
    },
    select: {
      id: true
    }
  });

  return doctor?.id ?? null;
}

function formatDate(date: Date | null): string | null {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function asRecord(value: Prisma.JsonValue): Prisma.JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function formatAnswerValue(value: Prisma.JsonValue | undefined): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string | number | boolean =>
        typeof item === "string" || typeof item === "number" || typeof item === "boolean"
      )
      .map(String)
      .join(", ");
  }

  return "-";
}

export function mapAssessmentAnswers(value: Prisma.JsonValue): DoctorAssessmentAnswer[] {
  return Object.entries(asRecord(value))
    .slice(0, 20)
    .map(([key, rawValue]) => {
      const answer = asRecord(rawValue ?? null);
      const label = typeof answer.label === "string" ? answer.label : key;
      const normalizedValue = answer.value ?? rawValue;

      return {
        key,
        label,
        value: formatAnswerValue(normalizedValue)
      };
    });
}

function mapConsultation(
  consultation: NonNullable<Awaited<ReturnType<typeof getScopedPatient>>>["consultations"][number]
): DoctorPatientConsultationDetail {
  return {
    id: consultation.id,
    status: consultation.status,
    statusLabel: consultationStatusLabels[consultation.status],
    scheduledAt: formatDate(consultation.scheduledAt),
    createdAt: formatDate(consultation.createdAt) ?? "",
    summary: consultation.summary,
    assessment: consultation.assessment
      ? {
          id: consultation.assessment.id,
          symptomLabel: consultation.assessment.symptomLabel,
          durationLabel: consultation.assessment.durationLabel,
          recommendationTopic: consultation.assessment.recommendationTopic,
          recommendationSpecialty: consultation.assessment.recommendationSpecialty,
          recommendationReason: consultation.assessment.recommendationReason,
          completedAt: formatDate(consultation.assessment.completedAt) ?? "",
          answers: mapAssessmentAnswers(consultation.assessment.answersJson)
        }
      : null,
    prescriptions: consultation.prescriptions.map((prescription) => ({
      id: prescription.id,
      status: prescription.status,
      notes: prescription.notes,
      medicationSummary:
        parsePrescriptionItems(prescription.itemsJson).map(formatPrescriptionItem).join("\n") || null,
      createdAt: formatDate(prescription.createdAt) ?? ""
    })),
    recentMessages: consultation.messages.map((message) => ({
      id: message.id,
      senderName: message.sender.displayName ?? getDoctorPatientReference(message.sender.lineUserId),
      body: message.body,
      createdAt: formatDate(message.createdAt) ?? ""
    }))
  };
}

function getScopedPatient(patientId: string, doctorId: string | undefined) {
  return prisma.user.findFirst({
    where: {
      id: patientId,
      consultations: {
        some: doctorId
          ? {
              doctorId
            }
          : {}
      }
    },
    select: {
      id: true,
      displayName: true,
      lineUserId: true,
      consultations: {
        where: doctorId
          ? {
              doctorId
            }
          : undefined,
        orderBy: {
          updatedAt: "desc"
        },
        take: 50,
        include: {
          assessment: true,
          prescriptions: {
            orderBy: {
              updatedAt: "desc"
            }
          },
          messages: {
            where: {
              status: "visible"
            },
            orderBy: {
              createdAt: "desc"
            },
            take: 5,
            include: {
              sender: true
            }
          }
        }
      }
    }
  });
}

export async function getDoctorPatientDetail(patientId: string): Promise<DoctorPatientDetailData> {
  noStore();

  try {
    const session = await requireDoctorSession();
    const doctorId = await getDoctorScope(session.userId, session.role);

    if (doctorId === null) {
      return {
        patient: null,
        missingDoctorProfile: true
      };
    }

    const patient = await getScopedPatient(patientId, doctorId);

    if (!patient) {
      return {
        patient: null
      };
    }

    await prisma.$transaction(async (tx) => {
      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "doctor.patient_record.read",
        entityType: "user",
        entityId: patient.id,
        metadata: {
          doctorId: doctorId ?? "admin_support",
          consultationCount: patient.consultations.length
        }
      });
    });

    return {
      patient: {
        id: patient.id,
        name: patient.displayName ?? "ผู้ป่วยจาก LINE",
        reference: getDoctorPatientReference(patient.lineUserId),
        consultations: patient.consultations.map(mapConsultation)
      }
    };
  } catch {
    return {
      patient: null,
      unavailable: true
    };
  }
}
