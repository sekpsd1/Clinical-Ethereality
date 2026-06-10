import { unstable_noStore as noStore } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { ConsultDoctorListData, ConsultDoctorListDoctor } from "@/features/consultations/doctor-list/types";

type ApprovedDoctorRecord = Awaited<ReturnType<typeof getApprovedDoctors>>[number];

const fallbackDoctor: ConsultDoctorListDoctor = {
  id: "fallback-kamonpat",
  name: "พญ. กมลภัทร วิจักขณ์พันธ์",
  specialty: "สูตินรีเวช และเวชศาสตร์มารดาและทารกในครรภ์",
  tags: ["#Telemedicine", "#VideoChat"],
  price: "฿800 / 15 นาที",
  rating: "4.9",
  imageSrc: "/images/doctors/kamonpat.jpg",
  bookingHref: "/consult/booking/somchai",
  isRecommended: false
};

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
  return new Intl.NumberFormat("th-TH", {
    currency: "THB",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value ?? 0);
}

function mapDoctor(doctor: ApprovedDoctorRecord, recommendedDoctorId: string | null): ConsultDoctorListDoctor {
  return {
    id: doctor.id,
    name: doctor.user.displayName ?? "แพทย์ผู้ให้คำปรึกษา",
    specialty: doctor.specialty ?? "ปรึกษาออนไลน์",
    tags: ["#Telemedicine", "#VideoChat"],
    price: `${formatMoney(doctor.consultationFee)} / 15 นาที`,
    rating: "4.9",
    imageSrc: doctor.user.avatarUrl?.startsWith("/") ? doctor.user.avatarUrl : "/images/doctors/kamonpat.jpg",
    bookingHref: "/consult/booking/somchai",
    isRecommended: doctor.id === recommendedDoctorId
  };
}

export async function getConsultDoctorListData(): Promise<ConsultDoctorListData> {
  noStore();

  try {
    const session = await getCurrentSession();
    const [doctors, activeAssessment] = await Promise.all([
      getApprovedDoctors(),
      session && !session.userId.startsWith("dev:")
        ? prisma.consultAssessment.findFirst({
            where: {
              userId: session.userId,
              expiresAt: {
                gt: new Date()
              }
            },
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

    return {
      doctors: doctors.length > 0 ? doctors.map((doctor) => mapDoctor(doctor, recommendedDoctorId)) : [fallbackDoctor],
      activeRecommendation: activeAssessment
        ? {
            topic: activeAssessment.recommendationTopic,
            specialty: activeAssessment.recommendationSpecialty
          }
        : null
    };
  } catch {
    return {
      doctors: [fallbackDoctor],
      activeRecommendation: null,
      unavailable: true
    };
  }
}
