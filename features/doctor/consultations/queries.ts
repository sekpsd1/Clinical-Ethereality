import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireDoctorSession } from "@/lib/auth/guards";
import type { DoctorConsultationItem, DoctorConsultationsData } from "@/features/doctor/consultations/types";

type ConsultationWithDetails = Awaited<ReturnType<typeof getConsultationsForDoctor>>[number];

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

function getConsultationsForDoctor(doctorId: string | undefined) {
  return prisma.consultation.findMany({
    where: doctorId
      ? {
          doctorId
        }
      : undefined,
    orderBy: [
      {
        scheduledAt: "desc"
      },
      {
        updatedAt: "desc"
      }
    ],
    take: 50,
    include: {
      patient: true,
      assessment: true,
      prescriptions: {
        orderBy: {
          updatedAt: "desc"
        },
        take: 3
      }
    }
  });
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

function mapConsultation(consultation: ConsultationWithDetails): DoctorConsultationItem {
  const latestPrescription = consultation.prescriptions[0] ?? null;

  return {
    id: consultation.id,
    patientName: consultation.patient.displayName ?? "LINE patient",
    patientLineId: consultation.patient.lineUserId,
    status: consultation.status,
    scheduledAt: formatDate(consultation.scheduledAt),
    summary: consultation.summary,
    prescriptionCount: consultation.prescriptions.length,
    latestPrescriptionId: latestPrescription?.id ?? null,
    latestPrescriptionStatus: latestPrescription?.status ?? null,
    latestPrescriptionNotes: latestPrescription?.notes ?? null,
    assessment: consultation.assessment
      ? {
          symptomLabel: consultation.assessment.symptomLabel,
          durationLabel: consultation.assessment.durationLabel,
          recommendationTopic: consultation.assessment.recommendationTopic,
          recommendationSpecialty: consultation.assessment.recommendationSpecialty,
          recommendationReason: consultation.assessment.recommendationReason,
          completedAt: formatDate(consultation.assessment.completedAt) ?? "",
          expiresAt: formatDate(consultation.assessment.expiresAt) ?? ""
        }
      : null,
    createdAt: formatDate(consultation.createdAt) ?? ""
  };
}

export async function getDoctorConsultations(): Promise<DoctorConsultationsData> {
  noStore();

  try {
    const session = await requireDoctorSession();
    const doctorId = await getDoctorScope(session.userId, session.role);

    if (doctorId === null) {
      return {
        consultations: [],
        summary: {
          scheduled: 0,
          live: 0,
          completed: 0
        },
        missingDoctorProfile: true
      };
    }

    const consultations = await getConsultationsForDoctor(doctorId);
    const consultationItems = consultations.map(mapConsultation);

    return {
      consultations: consultationItems,
      summary: {
        scheduled: consultationItems.filter((consultation) => consultation.status === "scheduled").length,
        live: consultationItems.filter((consultation) => consultation.status === "live").length,
        completed: consultationItems.filter((consultation) => consultation.status === "completed").length
      }
    };
  } catch {
    return {
      consultations: [],
      summary: {
        scheduled: 0,
        live: 0,
        completed: 0
      },
      unavailable: true
    };
  }
}
