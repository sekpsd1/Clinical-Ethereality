import type { ConsultationPrescriptionOutcomeStatus, PrescriptionStatus } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { PublicSession } from "@/lib/auth/types";
import { assertPermission } from "@/lib/permissions";
import type {
  CustomerConsultationPrescriptionOutcomeItem,
  CustomerPrescriptionItem,
  CustomerPrescriptionsData
} from "@/features/consultations/prescriptions/types";
import { getPrescriptionOrderStatusLabel, isPrescriptionOrderReady } from "@/features/products/prescriptions/readiness";
import { formatPrescriptionItem, parsePrescriptionItems } from "@/features/prescriptions/items";
import { prescriptionIssuedStatuses, prescriptionOutcomeLabels } from "@/features/prescriptions/outcome";

type PrescriptionRecord = Awaited<ReturnType<typeof getPrescriptionsForCustomer>>[number];
type ConsultationOutcomeRecord = Awaited<ReturnType<typeof getConsultationOutcomesForCustomer>>[number];

function getPrescriptionsForCustomer(userId: string) {
  return prisma.prescription.findMany({
    where: {
      patientId: userId
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 50,
    include: {
      consultation: true,
      doctor: {
        include: {
          user: true
        }
      },
      pharmacist: {
        include: {
          user: true
        }
      },
      orderItems: {
        include: {
          product: true,
          order: true
        }
      }
    }
  });
}

function getConsultationOutcomesForCustomer(userId: string) {
  return prisma.consultation.findMany({
    where: {
      patientId: userId,
      status: "completed",
      prescriptionOutcomeStatus: {
        in: ["pending_doctor_summary", "no_prescription"]
      },
      prescriptions: {
        none: {
          status: {
            in: prescriptionIssuedStatuses
          }
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 50,
    select: {
      id: true,
      prescriptionOutcomeStatus: true,
      scheduledAt: true,
      createdAt: true,
      doctor: {
        select: {
          user: {
            select: {
              displayName: true
            }
          }
        }
      }
    }
  });
}

function formatDate(date: Date | null): string {
  if (!date) {
    return "ยังไม่มีเวลาบันทึก";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getOrderCode(orderId: string): string {
  return `CE-${orderId.slice(-6).toUpperCase()}`;
}

function getStatusTone(status: PrescriptionStatus): CustomerPrescriptionItem["statusTone"] {
  if (isPrescriptionOrderReady(status) || status === "dispensed") {
    return "success";
  }

  if (status === "draft") {
    return "warning";
  }

  if (status === "rejected" || status === "archived") {
    return "danger";
  }

  return "neutral";
}

function getProductSummary(prescription: PrescriptionRecord): string {
  if (prescription.orderItems.length === 0) {
    return (
      parsePrescriptionItems(prescription.itemsJson)
        .map((item) => item.medicationName)
        .join(", ") || "ใบสั่งยาจากแพทย์"
    );
  }

  return prescription.orderItems.map((item) => `${item.product.name} x${item.quantity}`).join(", ");
}

function getLinkedOrderCode(prescription: PrescriptionRecord): string | null {
  const order = prescription.orderItems[0]?.order ?? null;

  return order ? getOrderCode(order.id) : null;
}

function getNextStep(
  status: PrescriptionStatus,
  hasOrder: boolean,
  prescriptionId: string,
  consultationId: string
) {
  if (isPrescriptionOrderReady(status) && !hasOrder) {
    return {
      title: "ใบสั่งยาพร้อมใช้",
      body: "คุณยังไม่ได้สั่งยาจากใบสั่งยานี้ กดปุ่ม “สั่งยาตามใบสั่งแพทย์” เพื่อเลือกที่อยู่และดำเนินการสั่งซื้อ",
      ctaLabel: "สั่งยาตามใบสั่งแพทย์",
      ctaHref: `/store/prescriptions/${prescriptionId}`
    };
  }

  if (isPrescriptionOrderReady(status) || status === "dispensed") {
    return {
      title: "ติดตามคำสั่งซื้อยา",
      body: "ใบสั่งยานี้เชื่อมกับคำสั่งซื้อแล้ว สามารถติดตามการชำระเงิน การจัดเตรียมยา และการจัดส่งได้",
      ctaLabel: "ติดตามคำสั่งซื้อ",
      ctaHref: "/store/orders"
    };
  }

  if (status === "rejected") {
    return {
      title: "ใบสั่งยาต้องให้แพทย์แก้ไข",
      body: "ใบสั่งยานี้ยังใช้สั่งซื้อไม่ได้ แพทย์สามารถปรับแก้และออกใบสั่งยาใหม่ได้จากคิวการปรึกษา",
      ctaLabel: "ดูสรุปคำแนะนำ",
      ctaHref: `/consult/advice-log?consultation=${encodeURIComponent(consultationId)}`
    };
  }

  return {
    title: "กำลังดำเนินการใบสั่งยา",
    body: "ทีมดูแลกำลังเตรียมข้อมูลใบสั่งยานี้",
    ctaLabel: "ดูหน้าปรึกษา",
    ctaHref: "/consult"
  };
}

function mapPrescription(prescription: PrescriptionRecord): CustomerPrescriptionItem {
  const hasOrder = prescription.orderItems.length > 0;
  const nextStep = getNextStep(
    prescription.status,
    hasOrder,
    prescription.id,
    prescription.consultationId
  );

  return {
    id: prescription.id,
    status: prescription.status,
    statusLabel: getPrescriptionOrderStatusLabel(prescription.status),
    statusTone: getStatusTone(prescription.status),
    doctorName: prescription.doctor.user.displayName ?? "แพทย์",
    pharmacistName: prescription.pharmacist?.user.displayName ?? null,
    consultationDate: formatDate(prescription.consultation.scheduledAt ?? prescription.consultation.createdAt),
    verifiedAt: prescription.verifiedAt ? formatDate(prescription.verifiedAt) : null,
    notes: prescription.notes ?? "ยังไม่มีบันทึกใบสั่งยา",
    medicationSummary:
      parsePrescriptionItems(prescription.itemsJson).map(formatPrescriptionItem).join("\n") || null,
    productSummary: getProductSummary(prescription),
    linkedOrderCode: getLinkedOrderCode(prescription),
    nextStepTitle: nextStep.title,
    nextStepBody: nextStep.body,
    ctaLabel: nextStep.ctaLabel,
    ctaHref: nextStep.ctaHref
  };
}

function mapConsultationOutcome(
  consultation: ConsultationOutcomeRecord
): CustomerConsultationPrescriptionOutcomeItem {
  const status = consultation.prescriptionOutcomeStatus as Exclude<
    ConsultationPrescriptionOutcomeStatus,
    "prescription_issued"
  >;

  return {
    consultationId: consultation.id,
    status,
    statusLabel: prescriptionOutcomeLabels[status],
    statusTone: status === "no_prescription" ? "success" : "neutral",
    doctorName: consultation.doctor.user.displayName ?? "แพทย์",
    consultationDate: formatDate(consultation.scheduledAt ?? consultation.createdAt)
  };
}

export async function getCustomerPrescriptions(session: PublicSession): Promise<CustomerPrescriptionsData> {
  noStore();
  assertPermission(session, "prescription:read:self");

  try {
    const [prescriptions, consultationOutcomes] = await Promise.all([
      getPrescriptionsForCustomer(session.userId),
      getConsultationOutcomesForCustomer(session.userId)
    ]);
    const items = prescriptions.map(mapPrescription);

    return {
      prescriptions: items,
      consultationOutcomes: consultationOutcomes.map(mapConsultationOutcome),
      summary: {
        pending: items.filter((item) => item.status === "draft").length,
        verified: items.filter((item) => isPrescriptionOrderReady(item.status) || item.status === "dispensed").length,
        rejected: items.filter((item) => item.status === "rejected" || item.status === "archived").length
      }
    };
  } catch {
    return {
      prescriptions: [],
      consultationOutcomes: [],
      summary: {
        pending: 0,
        verified: 0,
        rejected: 0
      },
      unavailable: true
    };
  }
}
