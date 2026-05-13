import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type {
  PharmacistPrescriptionItem,
  PharmacistPrescriptionsData
} from "@/features/pharmacist/prescriptions/types";

type PrescriptionWithDetails = Awaited<ReturnType<typeof getPrescriptionsForPharmacist>>[number];

function getPrescriptionsForPharmacist() {
  return prisma.prescription.findMany({
    orderBy: {
      updatedAt: "desc"
    },
    take: 50,
    include: {
      patient: true,
      doctor: {
        include: {
          user: true
        }
      },
      consultation: true,
      orderItems: {
        include: {
          product: true
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

function getProductSummary(prescription: PrescriptionWithDetails): string {
  if (prescription.orderItems.length === 0) {
    return "ยังไม่มีรายการยาที่เชื่อมกับคำสั่งซื้อ";
  }

  return prescription.orderItems.map((item) => `${item.product.name} x${item.quantity}`).join(", ");
}

function mapPrescription(prescription: PrescriptionWithDetails): PharmacistPrescriptionItem {
  return {
    id: prescription.id,
    status: prescription.status,
    patientName: prescription.patient.displayName ?? "ผู้ใช้ LINE ยังไม่ระบุชื่อ",
    doctorName: prescription.doctor.user.displayName ?? "แพทย์ยังไม่ระบุชื่อ",
    consultationSummary: prescription.consultation.summary,
    notes: prescription.notes,
    productSummary: getProductSummary(prescription),
    createdAt: formatDate(prescription.createdAt) ?? "",
    verifiedAt: formatDate(prescription.verifiedAt)
  };
}

export async function getPharmacistPrescriptions(): Promise<PharmacistPrescriptionsData> {
  noStore();

  try {
    const prescriptions = await getPrescriptionsForPharmacist();
    const prescriptionItems = prescriptions.map(mapPrescription);

    return {
      prescriptions: prescriptionItems,
      summary: {
        pendingVerification: prescriptionItems.filter((prescription) => prescription.status === "pending_verification").length,
        verified: prescriptionItems.filter((prescription) => prescription.status === "verified").length,
        rejected: prescriptionItems.filter((prescription) => prescription.status === "rejected").length
      }
    };
  } catch {
    return {
      prescriptions: [],
      summary: {
        pendingVerification: 0,
        verified: 0,
        rejected: 0
      },
      unavailable: true
    };
  }
}
