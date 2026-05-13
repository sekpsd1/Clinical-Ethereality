import type { ConsultationStatus } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { PublicSession } from "@/lib/auth/types";
import { assertPermission } from "@/lib/permissions";
import type { CustomerAppointmentData, CustomerAppointmentDetail } from "@/features/consultations/appointment/types";

type ConsultationRecord = NonNullable<Awaited<ReturnType<typeof getConsultationRecord>>>;

const statusContent: Record<
  ConsultationStatus,
  {
    label: string;
    tone: CustomerAppointmentDetail["statusTone"];
    nextStepLabel: string;
    nextStepDescription: string;
    ctaLabel: string;
  }
> = {
  requested: {
    label: "Requested",
    tone: "neutral",
    nextStepLabel: "Awaiting confirmation",
    nextStepDescription: "Your appointment request is being prepared before payment opens.",
    ctaLabel: "Review booking"
  },
  pending_payment: {
    label: "Payment pending",
    tone: "warning",
    nextStepLabel: "Complete payment",
    nextStepDescription: "Pay the consultation fee to hold this doctor slot.",
    ctaLabel: "Continue to payment"
  },
  scheduled: {
    label: "Scheduled",
    tone: "success",
    nextStepLabel: "Prepare for consultation",
    nextStepDescription: "Payment is confirmed. Open the waiting room before your appointment time.",
    ctaLabel: "Open waiting room"
  },
  live: {
    label: "Live now",
    tone: "success",
    nextStepLabel: "Join consultation",
    nextStepDescription: "Your consultation is active. Enter the waiting room to continue.",
    ctaLabel: "Join consultation"
  },
  completed: {
    label: "Completed",
    tone: "neutral",
    nextStepLabel: "Review advice log",
    nextStepDescription: "The consultation is complete. Review doctor notes and next actions.",
    ctaLabel: "View advice log"
  },
  cancelled: {
    label: "Cancelled",
    tone: "danger",
    nextStepLabel: "Book another time",
    nextStepDescription: "This appointment is no longer active.",
    ctaLabel: "Choose a new slot"
  }
};

function getConsultationRecord(consultationId: string, patientId: string) {
  return prisma.consultation.findFirst({
    where: {
      id: consultationId,
      patientId
    },
    include: {
      doctor: {
        include: {
          user: {
            select: {
              displayName: true,
              avatarUrl: true
            }
          }
        }
      }
    }
  });
}

function formatDate(date: Date | null): string {
  if (!date) {
    return "Time to be confirmed";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "full"
  }).format(date);
}

function formatTime(date: Date | null): string {
  if (!date) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatMoney(value: number | null): string {
  return new Intl.NumberFormat("th-TH", {
    currency: "THB",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value ?? 1000);
}

function getCtaHref(status: ConsultationStatus, consultationId: string): string {
  if (status === "scheduled" || status === "live") {
    return `/consult/waiting-room?consultation=${consultationId}`;
  }

  if (status === "completed") {
    return "/consult/advice-log";
  }

  if (status === "cancelled") {
    return "/consult/booking/somchai";
  }

  return `/consult/payment?consultation=${consultationId}`;
}

function mapConsultation(consultation: ConsultationRecord): CustomerAppointmentDetail {
  const status = statusContent[consultation.status];
  const avatarUrl = consultation.doctor.user.avatarUrl?.startsWith("/")
    ? consultation.doctor.user.avatarUrl
    : "/images/doctors/somchai-payment.png";

  return {
    id: consultation.id,
    doctorName: consultation.doctor.user.displayName ?? "Dr. Somchai Rattanawongsan",
    doctorSpecialty: consultation.doctor.specialty ?? "Aesthetic medicine",
    doctorAvatarUrl: avatarUrl,
    scheduledDate: formatDate(consultation.scheduledAt),
    scheduledTime: formatTime(consultation.scheduledAt),
    scheduledIso: consultation.scheduledAt?.toISOString() ?? null,
    status: consultation.status,
    statusLabel: status.label,
    statusTone: status.tone,
    feeLabel: formatMoney(consultation.doctor.consultationFee),
    nextStepLabel: status.nextStepLabel,
    nextStepDescription: status.nextStepDescription,
    ctaLabel: status.ctaLabel,
    ctaHref: getCtaHref(consultation.status, consultation.id)
  };
}

export async function getCustomerAppointmentDetail(
  session: PublicSession,
  consultationId: string
): Promise<CustomerAppointmentData> {
  noStore();
  assertPermission(session, "consultation:read:self");

  try {
    const consultation = await getConsultationRecord(consultationId, session.userId);

    return {
      appointment: consultation ? mapConsultation(consultation) : null
    };
  } catch {
    return {
      appointment: null,
      unavailable: true
    };
  }
}
