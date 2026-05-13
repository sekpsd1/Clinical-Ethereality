import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { PublicSession } from "@/lib/auth/types";
import { assertPermission } from "@/lib/permissions";
import type {
  PrescriptionOrderData,
  PrescriptionOrderDetail,
  PrescriptionOrderProduct
} from "@/features/products/prescriptions/types";

type PrescriptionRecord = NonNullable<Awaited<ReturnType<typeof getPrescriptionForOrder>>>;
type ProductRecord = Awaited<ReturnType<typeof getPrescriptionProducts>>[number];

function getPrescriptionForOrder(prescriptionId: string, patientId: string) {
  return prisma.prescription.findFirst({
    where: {
      id: prescriptionId,
      patientId
    },
    include: {
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
          order: true,
          product: true
        }
      }
    }
  });
}

function getPrescriptionProducts() {
  return prisma.product.findMany({
    where: {
      status: "active",
      requiresPrescription: true
    },
    orderBy: {
      updatedAt: "desc"
    },
    include: {
      inventory: true
    },
    take: 20
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

function formatMoney(value: unknown): string {
  return new Intl.NumberFormat("th-TH", {
    currency: "THB",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(Number(value));
}

function getOrderCode(orderId: string): string {
  return `CE-${orderId.slice(-6).toUpperCase()}`;
}

function getAvailableQuantity(product: ProductRecord): number {
  return Math.max((product.inventory?.quantity ?? 0) - (product.inventory?.reservedQuantity ?? 0), 0);
}

function mapProduct(product: ProductRecord): PrescriptionOrderProduct {
  const availableQuantity = getAvailableQuantity(product);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description ?? "ผลิตภัณฑ์ที่ต้องใช้ใบสั่งยาจากแพทย์ก่อนสั่งซื้อ",
    priceLabel: formatMoney(product.price),
    stockLabel: availableQuantity > 0 ? `พร้อมจัดส่ง ${availableQuantity} ชิ้น` : "สินค้าหมด",
    availableQuantity
  };
}

function mapPrescription(prescription: PrescriptionRecord, products: ProductRecord[]): PrescriptionOrderDetail {
  const linkedOrder = prescription.orderItems[0]?.order ?? null;

  return {
    id: prescription.id,
    statusLabel: prescription.status === "verified" ? "ตรวจผ่านแล้ว" : "ยังไม่พร้อมสั่งซื้อ",
    doctorName: prescription.doctor.user.displayName ?? "แพทย์",
    pharmacistName: prescription.pharmacist?.user.displayName ?? null,
    verifiedAt: formatDate(prescription.verifiedAt),
    notes: prescription.notes ?? "ยังไม่มีบันทึกใบสั่งยา",
    linkedOrderCode: linkedOrder ? getOrderCode(linkedOrder.id) : null,
    products: products.map(mapProduct)
  };
}

export async function getPrescriptionOrderData(
  session: PublicSession,
  prescriptionId: string
): Promise<PrescriptionOrderData> {
  noStore();
  assertPermission(session, "prescription:read:self");

  try {
    const prescription = await getPrescriptionForOrder(prescriptionId, session.userId);

    if (!prescription) {
      return {
        prescription: null
      };
    }

    const products = prescription.status === "verified" ? await getPrescriptionProducts() : [];

    return {
      prescription: mapPrescription(prescription, products)
    };
  } catch {
    return {
      prescription: null,
      unavailable: true
    };
  }
}
