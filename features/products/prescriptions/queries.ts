import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { PublicSession } from "@/lib/auth/types";
import { assertPermission } from "@/lib/permissions";
import type {
  PrescriptionOrderData,
  PrescriptionOrderDetail,
  PrescriptionOrderProduct
} from "@/features/products/prescriptions/types";
import { getPrescriptionOrderStatusLabel, isPrescriptionOrderReady } from "@/features/products/prescriptions/readiness";
import { formatPrescriptionItem, parsePrescriptionItems } from "@/features/prescriptions/items";

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

function getPrescriptionProducts(productIds: string[]) {
  return prisma.product.findMany({
    where: {
      id: {
        in: productIds
      },
      status: "active",
      requiresPrescription: true
    },
    include: {
      inventory: true
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

function formatMoney(value: unknown): string {
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Number(value))} บาท`;
}

function getOrderCode(orderId: string): string {
  return `CE-${orderId.slice(-6).toUpperCase()}`;
}

function getAvailableQuantity(product: ProductRecord): number {
  return Math.max((product.inventory?.quantity ?? 0) - (product.inventory?.reservedQuantity ?? 0), 0);
}

function mapProduct(product: ProductRecord, prescribedQuantity: number): PrescriptionOrderProduct {
  const availableQuantity = getAvailableQuantity(product);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description:
      product.shortDescription ??
      product.description ??
      "ผลิตภัณฑ์ที่ต้องใช้ใบสั่งยาจากแพทย์ก่อนสั่งซื้อ",
    priceLabel: formatMoney(product.price),
    stockLabel:
      availableQuantity >= prescribedQuantity
        ? `พร้อมจัดส่ง ${availableQuantity} ชิ้น`
        : `คงเหลือ ${availableQuantity} ชิ้น`,
    availableQuantity,
    prescribedQuantity
  };
}

function getPrescribedQuantities(itemsJson: PrescriptionRecord["itemsJson"]): Map<string, number> {
  const quantities = new Map<string, number>();

  for (const item of parsePrescriptionItems(itemsJson)) {
    const quantity = Number(item.quantity);

    if (!item.productId || !Number.isSafeInteger(quantity) || quantity <= 0) {
      return new Map();
    }

    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + quantity);
  }

  return quantities;
}

function mapPrescription(
  prescription: PrescriptionRecord,
  products: ProductRecord[],
  prescribedQuantities: Map<string, number>
): PrescriptionOrderDetail {
  const linkedOrder =
    prescription.orderItems
      .map((orderItem) => orderItem.order)
      .find(
        (order) =>
          order.status !== "cancelled" && order.status !== "refunded",
      ) ?? null;

  return {
    id: prescription.id,
    statusLabel: getPrescriptionOrderStatusLabel(prescription.status),
    doctorName: prescription.doctor.user.displayName ?? "แพทย์",
    pharmacistName: prescription.pharmacist?.user.displayName ?? null,
    verifiedAt: formatDate(prescription.verifiedAt),
    notes: prescription.notes ?? "ยังไม่มีบันทึกใบสั่งยา",
    medicationSummary:
      parsePrescriptionItems(prescription.itemsJson).map(formatPrescriptionItem).join("\n") || null,
    linkedOrderCode: linkedOrder ? getOrderCode(linkedOrder.id) : null,
    isProductMappingComplete: prescribedQuantities.size > 0 && products.length === prescribedQuantities.size,
    products: products.flatMap((product) => {
      const prescribedQuantity = prescribedQuantities.get(product.id);
      return prescribedQuantity ? [mapProduct(product, prescribedQuantity)] : [];
    })
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

    const prescribedQuantities = getPrescribedQuantities(prescription.itemsJson);
    const products =
      isPrescriptionOrderReady(prescription.status) && prescribedQuantities.size > 0
        ? await getPrescriptionProducts([...prescribedQuantities.keys()])
        : [];

    return {
      prescription: mapPrescription(prescription, products, prescribedQuantities)
    };
  } catch {
    return {
      prescription: null,
      unavailable: true
    };
  }
}
