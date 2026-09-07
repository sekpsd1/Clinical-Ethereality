import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { PublicSession } from "@/lib/auth/types";
import { assertPermission, assertRole } from "@/lib/permissions";
import { CLINIC_TIME_ZONE } from "@/features/consultations/booking/slots";
import type {
  AdviceLogMedication,
  CustomerAdviceLog,
  CustomerAdviceLogData
} from "@/features/consultations/advice-log/types";
import { adviceLogConsultationIdSchema } from "@/features/consultations/advice-log/schema";
import { parsePrescriptionItems } from "@/features/prescriptions/items";
import { staffFileEntityTypes } from "@/features/staff-files/types";

type AdviceLogRecord = NonNullable<Awaited<ReturnType<typeof findCompletedConsultation>>>;

function findCompletedConsultation(patientId: string, consultationId?: string) {
  return prisma.consultation.findFirst({
    where: {
      ...(consultationId ? { id: consultationId } : {}),
      patientId,
      status: "completed"
    },
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      id: true,
      scheduledAt: true,
      bookedDurationMinutes: true,
      summary: true,
      doctor: {
        select: {
          specialty: true,
          userId: true,
          user: {
            select: {
              displayName: true,
              avatarUrl: true
            }
          }
        }
      },
      prescriptions: {
        where: {
          status: {
            in: ["verified", "dispensed"]
          }
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 1,
        select: {
          id: true,
          itemsJson: true
        }
      }
    }
  });
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: CLINIC_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatAppointment(
  scheduledAt: Date | null,
  bookedDurationMinutes: number | null
): string {
  if (!scheduledAt) {
    return "ไม่พบเวลานัดหมายเดิม";
  }

  const dateLabel = new Intl.DateTimeFormat("th-TH", {
    timeZone: CLINIC_TIME_ZONE,
    dateStyle: "medium"
  }).format(scheduledAt);
  const startLabel = formatTime(scheduledAt);

  if (!bookedDurationMinutes) {
    return `${dateLabel} | ${startLabel}`;
  }

  const endAt = new Date(scheduledAt.getTime() + bookedDurationMinutes * 60_000);
  return `${dateLabel} | ${startLabel} - ${formatTime(endAt)}`;
}

function mapMedications(record: AdviceLogRecord): AdviceLogMedication[] {
  const prescription = record.prescriptions[0];

  if (!prescription) {
    return [];
  }

  return parsePrescriptionItems(prescription.itemsJson).map((item) => ({
    name: item.medicationName,
    details: [`ขนาด ${item.dosage}`, `จำนวน ${item.quantity}`, item.instructions].join(" • "),
    warning: item.warnings ? `คำเตือน: ${item.warnings}` : null
  }));
}

async function mapAdviceLog(record: AdviceLogRecord): Promise<CustomerAdviceLog> {
  const profilePhoto = await prisma.fileAttachment.findFirst({
    where: {
      ownerId: record.doctor.userId,
      entityType: staffFileEntityTypes.profilePhoto,
      status: "attached",
      storageKey: { not: null }
    },
    select: {
      storageUrl: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });
  const prescription = record.prescriptions[0];

  return {
    consultationId: record.id,
    doctorName: record.doctor.user.displayName ?? "แพทย์ผู้ให้คำปรึกษา",
    doctorSpecialty: record.doctor.specialty ?? "แพทย์ผู้ให้คำปรึกษา",
    doctorAvatarUrl: profilePhoto?.storageUrl ?? record.doctor.user.avatarUrl,
    appointmentLabel: formatAppointment(record.scheduledAt, record.bookedDurationMinutes),
    summary: record.summary?.trim() || null,
    medications: mapMedications(record),
    prescriptionHref: prescription ? "/consult/prescriptions" : null,
    returnHref: `/consult/appointments/${encodeURIComponent(record.id)}`
  };
}

export async function getCustomerAdviceLog(
  session: PublicSession,
  consultationId?: string
): Promise<CustomerAdviceLogData> {
  noStore();
  assertRole(session, ["customer"]);
  assertPermission(session, "consultation:read:self");

  const parsedConsultationId =
    consultationId === undefined
      ? null
      : adviceLogConsultationIdSchema.safeParse(consultationId);

  if (parsedConsultationId && !parsedConsultationId.success) {
    return {
      advice: null
    };
  }

  try {
    const consultation = await findCompletedConsultation(
      session.userId,
      parsedConsultationId?.data
    );

    return {
      advice: consultation ? await mapAdviceLog(consultation) : null
    };
  } catch {
    return {
      advice: null,
      unavailable: true
    };
  }
}
