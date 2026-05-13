import type { PrescriptionStatus } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { PublicSession } from "@/lib/auth/types";
import { assertPermission } from "@/lib/permissions";
import type { CustomerPrescriptionItem, CustomerPrescriptionsData } from "@/features/consultations/prescriptions/types";

type PrescriptionRecord = Awaited<ReturnType<typeof getPrescriptionsForCustomer>>[number];

const statusLabels: Record<PrescriptionStatus, string> = {
  draft: "Draft",
  pending_verification: "Pharmacist review",
  verified: "Verified",
  rejected: "Rejected",
  dispensed: "Dispensed",
  archived: "Archived"
};

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

function formatDate(date: Date | null): string {
  if (!date) {
    return "Time not recorded";
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
  if (status === "verified" || status === "dispensed") {
    return "success";
  }

  if (status === "pending_verification" || status === "draft") {
    return "warning";
  }

  if (status === "rejected" || status === "archived") {
    return "danger";
  }

  return "neutral";
}

function getProductSummary(prescription: PrescriptionRecord): string {
  if (prescription.orderItems.length === 0) {
    return "No medicine order is linked yet";
  }

  return prescription.orderItems.map((item) => `${item.product.name} x${item.quantity}`).join(", ");
}

function getLinkedOrderCode(prescription: PrescriptionRecord): string | null {
  const order = prescription.orderItems[0]?.order ?? null;

  return order ? getOrderCode(order.id) : null;
}

function getNextStep(status: PrescriptionStatus, hasOrder: boolean) {
  if (status === "pending_verification") {
    return {
      title: "Waiting for pharmacist verification",
      body: "The pharmacy team is checking the doctor note before medicine preparation can start.",
      ctaLabel: "View advice log",
      ctaHref: "/consult/advice-log"
    };
  }

  if (status === "verified" && !hasOrder) {
    return {
      title: "Prescription verified",
      body: "The prescription is ready. Add the prescribed medicine from the store flow when the catalog item is available.",
      ctaLabel: "Browse store",
      ctaHref: "/store"
    };
  }

  if (status === "verified" || status === "dispensed") {
    return {
      title: "Follow medicine order",
      body: "This prescription is linked to an order. Track payment, pharmacy preparation, and shipment in orders.",
      ctaLabel: "Track order",
      ctaHref: "/store/orders"
    };
  }

  if (status === "rejected") {
    return {
      title: "Prescription needs doctor review",
      body: "The pharmacist rejected this prescription. The doctor can revise and resubmit it from the consultation queue.",
      ctaLabel: "View advice log",
      ctaHref: "/consult/advice-log"
    };
  }

  return {
    title: "Prescription in progress",
    body: "The care team is still preparing this prescription record.",
    ctaLabel: "View consult",
    ctaHref: "/consult"
  };
}

function mapPrescription(prescription: PrescriptionRecord): CustomerPrescriptionItem {
  const hasOrder = prescription.orderItems.length > 0;
  const nextStep = getNextStep(prescription.status, hasOrder);

  return {
    id: prescription.id,
    status: prescription.status,
    statusLabel: statusLabels[prescription.status],
    statusTone: getStatusTone(prescription.status),
    doctorName: prescription.doctor.user.displayName ?? "Doctor",
    pharmacistName: prescription.pharmacist?.user.displayName ?? null,
    consultationDate: formatDate(prescription.consultation.scheduledAt ?? prescription.consultation.createdAt),
    verifiedAt: prescription.verifiedAt ? formatDate(prescription.verifiedAt) : null,
    notes: prescription.notes ?? "No prescription note has been added yet.",
    productSummary: getProductSummary(prescription),
    linkedOrderCode: getLinkedOrderCode(prescription),
    nextStepTitle: nextStep.title,
    nextStepBody: nextStep.body,
    ctaLabel: nextStep.ctaLabel,
    ctaHref: nextStep.ctaHref
  };
}

export async function getCustomerPrescriptions(session: PublicSession): Promise<CustomerPrescriptionsData> {
  noStore();
  assertPermission(session, "prescription:read:self");

  try {
    const prescriptions = await getPrescriptionsForCustomer(session.userId);
    const items = prescriptions.map(mapPrescription);

    return {
      prescriptions: items,
      summary: {
        pending: items.filter((item) => item.status === "pending_verification" || item.status === "draft").length,
        verified: items.filter((item) => item.status === "verified" || item.status === "dispensed").length,
        rejected: items.filter((item) => item.status === "rejected" || item.status === "archived").length
      }
    };
  } catch {
    return {
      prescriptions: [],
      summary: {
        pending: 0,
        verified: 0,
        rejected: 0
      },
      unavailable: true
    };
  }
}
