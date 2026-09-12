import { unstable_noStore as noStore } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { ConsultDoctorListData, ConsultDoctorListDoctor } from "@/features/consultations/doctor-list/types";
import {
  getAssessmentConsentPath,
  getConsultBookingPath
} from "@/features/consultations/assessment/routes";
import { getActiveConsultAssessmentWhere } from "@/features/consultations/assessment/validity";

type ApprovedDoctorRecord = Awaited<ReturnType<typeof getApprovedDoctors>>[number];

const fallbackDoctorBase = {
  id: "fallback-kamonpat",
  name: "พญ. กมลภัทร วิจักขณ์พันธ์",
  specialty: "สูตินรีเวช และเวชศาสตร์มารดาและทารกในครรภ์",
  tags: ["#Telemedicine", "#VideoChat"],
  price: "800 บาท / 15 นาที",
  rating: "4.9",
  imageSrc: "/images/doctors/kamonpat.jpg",
  isRecommended: false
};

function getFallbackDoctor(hasActiveAssessment: boolean): ConsultDoctorListDoctor {
  return {
    ...fallbackDoctorBase,
    bookingHref: hasActiveAssessment ? "/consult/booking/somchai" : "/consult/assessment"
  };
}

function getApprovedDoctors() {
  return prisma.doctor.findMany({
    where: {
      status: "approved",
      user: {
        status: "active"
      }
    },
    orderBy: {
      approvedAt: "desc"
    },
    include: {
      user: {
        select: {
          avatarUrl: true,
          displayName: true
        }
      }
    }
  });
}

function formatMoney(value: number | null): string {
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value ?? 0)} บาท`;
}

function mapDoctor(
  doctor: ApprovedDoctorRecord,
  recommendedDoctorId: string | null,
  hasActiveAssessment: boolean
): ConsultDoctorListDoctor {
  return {
    id: doctor.id,
    name: doctor.user.displayName ?? "แพทย์ผู้ให้คำปรึกษา",
    specialty: doctor.specialty ?? "ปรึกษาออนไลน์",
    tags: ["#Telemedicine", "#VideoChat"],
    price: `${formatMoney(doctor.consultationFee)} / 15 นาที`,
    rating: "4.9",
    // DoctorAvatar owns the loading fallback. Staff attachments may be stored as
    // either a private app route or a permitted absolute storage URL.
    imageSrc: doctor.user.avatarUrl ?? "/images/doctors/kamonpat.jpg",
    bookingHref: hasActiveAssessment
      ? getConsultBookingPath(doctor.id)
      : getAssessmentConsentPath(doctor.id),
    isRecommended: doctor.id === recommendedDoctorId
  };
}

export async function getConsultDoctorListData(): Promise<ConsultDoctorListData> {
  noStore();

  try {
    const session = await getCurrentSession();
    const now = new Date();
    const [doctors, activeAssessment] = await Promise.all([
      getApprovedDoctors(),
      session && !session.userId.startsWith("dev:")
        ? prisma.consultAssessment.findFirst({
            where: getActiveConsultAssessmentWhere(session.userId, now),
            orderBy: {
              completedAt: "desc"
            },
            select: {
              recommendationTopic: true,
              recommendationSpecialty: true
            }
          })
        : null
    ]);

    const recommendedDoctorId = activeAssessment ? doctors[0]?.id ?? null : null;
    const hasActiveAssessment = Boolean(activeAssessment);

    return {
      doctors: doctors.length > 0
        ? doctors.map((doctor) => mapDoctor(doctor, recommendedDoctorId, hasActiveAssessment))
        : [getFallbackDoctor(hasActiveAssessment)],
      activeRecommendation: activeAssessment
        ? {
            topic: activeAssessment.recommendationTopic,
            specialty: activeAssessment.recommendationSpecialty
          }
        : null
    };
  } catch {
    return {
      doctors: [getFallbackDoctor(false)],
      activeRecommendation: null,
      unavailable: true
    };
  }
}
