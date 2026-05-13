import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireDoctorSession } from "@/lib/auth/guards";
import type { DoctorPatientLogItem, DoctorPatientsData } from "@/features/doctor/patients/types";

type ConsultationWithDetails = Awaited<ReturnType<typeof getPatientLogsForDoctor>>[number];

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

function getPatientLogsForDoctor(doctorId: string | undefined) {
  return prisma.consultation.findMany({
    where: doctorId
      ? {
          doctorId
        }
      : undefined,
    orderBy: {
      updatedAt: "desc"
    },
    take: 100,
    include: {
      patient: true,
      prescriptions: {
        orderBy: {
          updatedAt: "desc"
        }
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

function mapPatientLogs(consultations: ConsultationWithDetails[]): DoctorPatientLogItem[] {
  const logsByPatient = new Map<string, ConsultationWithDetails[]>();

  for (const consultation of consultations) {
    const patientLogs = logsByPatient.get(consultation.patientId) ?? [];
    patientLogs.push(consultation);
    logsByPatient.set(consultation.patientId, patientLogs);
  }

  return Array.from(logsByPatient.values()).map((patientConsultations) => {
    const latestConsultation = patientConsultations[0];
    const prescriptions = patientConsultations.flatMap((consultation) => consultation.prescriptions);
    const latestPrescription = prescriptions[0] ?? null;

    return {
      id: latestConsultation.patientId,
      patientName: latestConsultation.patient.displayName ?? "LINE patient",
      patientLineId: latestConsultation.patient.lineUserId,
      consultationCount: patientConsultations.length,
      latestConsultationStatus: latestConsultation.status,
      latestConsultationAt: formatDate(latestConsultation.scheduledAt ?? latestConsultation.updatedAt),
      latestSummary: latestConsultation.summary,
      prescriptionCount: prescriptions.length,
      latestPrescriptionStatus: latestPrescription?.status ?? null
    };
  });
}

export async function getDoctorPatients(): Promise<DoctorPatientsData> {
  noStore();

  try {
    const session = await requireDoctorSession();
    const doctorId = await getDoctorScope(session.userId, session.role);

    if (doctorId === null) {
      return {
        patients: [],
        summary: {
          totalPatients: 0,
          activeConsultations: 0,
          prescriptions: 0
        },
        missingDoctorProfile: true
      };
    }

    const consultations = await getPatientLogsForDoctor(doctorId);
    const patients = mapPatientLogs(consultations);

    return {
      patients,
      summary: {
        totalPatients: patients.length,
        activeConsultations: consultations.filter((consultation) => consultation.status === "scheduled" || consultation.status === "live").length,
        prescriptions: consultations.reduce((total, consultation) => total + consultation.prescriptions.length, 0)
      }
    };
  } catch {
    return {
      patients: [],
      summary: {
        totalPatients: 0,
        activeConsultations: 0,
        prescriptions: 0
      },
      unavailable: true
    };
  }
}
