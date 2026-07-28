import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import {
  getAdminConsultationStatusCopy,
  getCustomerJourneyLabel,
  isAssessmentActive
} from "@/features/admin/customers/status";
import type {
  AdminCustomerAssessment,
  AdminCustomerConsultation,
  AdminCustomerDetailData,
  AdminCustomerListItem,
  AdminCustomersData
} from "@/features/admin/customers/types";

type CustomerListRecord = Awaited<ReturnType<typeof getCustomerListRecords>>[number];
type CustomerDetailRecord = NonNullable<Awaited<ReturnType<typeof getCustomerDetailRecord>>>;
type CustomerConsultationRecord =
  | CustomerListRecord["consultations"][number]
  | CustomerListRecord["consultAssessments"][number]["consultations"][number]
  | CustomerDetailRecord["consultations"][number];
type CustomerAssessmentRecord =
  | CustomerListRecord["consultAssessments"][number]
  | CustomerDetailRecord["consultAssessments"][number];

function getRecommendedDoctor() {
  return prisma.doctor.findFirst({
    where: {
      status: "approved",
      user: {
        status: "active"
      }
    },
    orderBy: {
      approvedAt: "desc"
    },
    select: {
      user: {
        select: {
          displayName: true
        }
      }
    }
  });
}

function consultationInclude() {
  return {
    doctor: {
      include: {
        user: {
          select: {
            displayName: true
          }
        }
      }
    }
  } as const;
}

function getCustomerListRecords() {
  return prisma.user.findMany({
    where: {
      role: "customer",
      status: {
        in: ["active", "suspended", "archived"]
      },
      doctorProfile: {
        is: null
      },
      pharmacistProfile: {
        is: null
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 50,
    include: {
      consultAssessments: {
        orderBy: {
          completedAt: "desc"
        },
        take: 1,
        include: {
          consultations: {
            orderBy: {
              updatedAt: "desc"
            },
            take: 1,
            include: consultationInclude()
          }
        }
      },
      consultations: {
        orderBy: {
          updatedAt: "desc"
        },
        take: 1,
        include: consultationInclude()
      },
      _count: {
        select: {
          consultAssessments: true,
          consultations: true,
          orders: true
        }
      }
    }
  });
}

function getCustomerDetailRecord(customerId: string) {
  return prisma.user.findFirst({
    where: {
      id: customerId,
      role: "customer",
      status: {
        in: ["active", "suspended", "archived"]
      },
      doctorProfile: {
        is: null
      },
      pharmacistProfile: {
        is: null
      }
    },
    include: {
      consultAssessments: {
        orderBy: {
          completedAt: "desc"
        },
        take: 10,
        include: {
          consultations: {
            orderBy: {
              updatedAt: "desc"
            },
            take: 1,
            include: consultationInclude()
          }
        }
      },
      consultations: {
        orderBy: {
          updatedAt: "desc"
        },
        take: 20,
        include: consultationInclude()
      },
      _count: {
        select: {
          orders: true
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
    timeStyle: "short",
    hourCycle: "h23"
  }).format(date);
}

function formatCustomerReference(lineUserId: string): string {
  const suffix = lineUserId.slice(-6);

  return `LINE •••${suffix}`;
}

function mapConsultation(consultation: CustomerConsultationRecord): AdminCustomerConsultation {
  const copy = getAdminConsultationStatusCopy(consultation.status);

  return {
    id: consultation.id,
    status: consultation.status,
    statusLabel: copy.label,
    paymentLabel: copy.paymentLabel,
    tone: copy.tone,
    doctorName: consultation.doctor.user.displayName ?? "แพทย์ผู้ให้คำปรึกษา",
    doctorSpecialty: consultation.doctor.specialty ?? "ปรึกษาออนไลน์",
    scheduledAt: formatDate(consultation.scheduledAt),
    createdAt: formatDate(consultation.createdAt) ?? "",
    assessmentId: consultation.assessmentId
  };
}

function mapAssessment(assessment: CustomerAssessmentRecord): AdminCustomerAssessment {
  return {
    id: assessment.id,
    symptomLabel: assessment.symptomLabel,
    durationLabel: assessment.durationLabel,
    recommendationTopic: assessment.recommendationTopic,
    recommendationSpecialty: assessment.recommendationSpecialty,
    recommendationReason: assessment.recommendationReason,
    completedAt: formatDate(assessment.completedAt) ?? "",
    expiresAt: formatDate(assessment.expiresAt) ?? "",
    isActive: isAssessmentActive(assessment.expiresAt),
    linkedConsultationId: assessment.consultations[0]?.id ?? null
  };
}

function mapCustomerListItem(
  customer: CustomerListRecord,
  recommendedDoctorName: string | null
): AdminCustomerListItem {
  const assessmentRecord = customer.consultAssessments[0] ?? null;
  const latestAssessment = assessmentRecord ? mapAssessment(assessmentRecord) : null;
  const latestConsultation = customer.consultations[0] ? mapConsultation(customer.consultations[0]) : null;
  const bookedConsultation = assessmentRecord?.consultations[0]
    ? mapConsultation(assessmentRecord.consultations[0])
    : null;
  const journeyLabel = getCustomerJourneyLabel({
    hasAssessment: Boolean(latestAssessment),
    assessmentIsActive: latestAssessment?.isActive ?? false,
    consultationStatus: bookedConsultation?.status ?? null
  });

  return {
    id: customer.id,
    name: customer.displayName ?? "ผู้ใช้ LINE ยังไม่ระบุชื่อ",
    reference: formatCustomerReference(customer.lineUserId),
    accountStatus: customer.status,
    latestAssessment,
    assessmentStatusLabel: latestAssessment
      ? latestAssessment.isActive
        ? "แบบประเมินยังใช้ได้"
        : "แบบประเมินหมดอายุ"
      : "ยังไม่มีแบบประเมิน",
    journeyLabel,
    journeyTone: bookedConsultation?.tone ?? (latestAssessment?.isActive ? "warning" : "neutral"),
    latestConsultation,
    bookedConsultation,
    recommendedDoctorName: latestAssessment ? recommendedDoctorName : null,
    consultationCount: customer._count.consultations,
    assessmentCount: customer._count.consultAssessments,
    orderCount: customer._count.orders,
    updatedAt: formatDate(customer.updatedAt) ?? ""
  };
}

export async function getAdminCustomers(): Promise<AdminCustomersData> {
  noStore();

  try {
    const [customers, recommendedDoctor] = await Promise.all([getCustomerListRecords(), getRecommendedDoctor()]);
    const recommendedDoctorName = recommendedDoctor?.user.displayName ?? null;
    const customerItems = customers.map((customer) => mapCustomerListItem(customer, recommendedDoctorName));

    return {
      customers: customerItems,
      summary: {
        total: customerItems.length,
        activeAssessments: customerItems.filter((customer) => customer.latestAssessment?.isActive).length,
        awaitingBooking: customerItems.filter(
          (customer) => customer.latestAssessment?.isActive && !customer.bookedConsultation
        ).length,
        booked: customerItems.filter((customer) => Boolean(customer.bookedConsultation)).length
      }
    };
  } catch {
    return {
      customers: [],
      summary: {
        total: 0,
        activeAssessments: 0,
        awaitingBooking: 0,
        booked: 0
      },
      unavailable: true
    };
  }
}

export async function getAdminCustomerDetail(customerId: string): Promise<AdminCustomerDetailData> {
  noStore();

  try {
    const [customer, recommendedDoctor] = await Promise.all([
      getCustomerDetailRecord(customerId),
      getRecommendedDoctor()
    ]);

    if (!customer) {
      return {
        customer: null
      };
    }

    return {
      customer: {
        id: customer.id,
        name: customer.displayName ?? "ผู้ใช้ LINE ยังไม่ระบุชื่อ",
        reference: formatCustomerReference(customer.lineUserId),
        email: customer.email,
        phone: customer.phone,
        accountStatus: customer.status,
        rewardBalance: customer.rewardBalance,
        createdAt: formatDate(customer.createdAt) ?? "",
        lastLoginAt: formatDate(customer.lastLoginAt),
        recommendedDoctorName: recommendedDoctor?.user.displayName ?? null,
        assessments: customer.consultAssessments.map(mapAssessment),
        consultations: customer.consultations.map(mapConsultation),
        orderCount: customer._count.orders
      }
    };
  } catch {
    return {
      customer: null,
      unavailable: true
    };
  }
}
