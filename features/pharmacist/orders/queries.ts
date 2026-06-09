import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { PharmacistOrderQueueItem, PharmacistOrdersData } from "@/features/pharmacist/orders/types";

type OrderWithDetails = Awaited<ReturnType<typeof getOrdersForPharmacist>>[number];
type ExternalPrescriptionAttachmentSummary = {
  count: number;
  fileName: string | null;
};

function getOrdersForPharmacist() {
  return prisma.order.findMany({
    where: {
      status: {
        in: ["paid", "preparing", "shipped"]
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 50,
    include: {
      user: true,
      items: {
        include: {
          product: true,
          prescription: true
        }
      },
      payments: {
        orderBy: {
          updatedAt: "desc"
        },
        take: 1
      },
      shipments: {
        orderBy: {
          updatedAt: "desc"
        },
        take: 1
      }
    }
  });
}

function formatMoney(value: unknown): string {
  return new Intl.NumberFormat("th-TH", {
    currency: "THB",
    style: "currency"
  }).format(Number(value));
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getOrderCode(orderId: string): string {
  return `CE-${orderId.slice(-6).toUpperCase()}`;
}

function getItemSummary(order: OrderWithDetails): string {
  if (order.items.length === 0) {
    return "No products in this order";
  }

  return order.items.map((item) => `${item.product.name} x${item.quantity}`).join(", ");
}

function mapExternalPrescriptionAttachments(
  attachments: Array<{ entityId: string; fileName: string }>
): Map<string, ExternalPrescriptionAttachmentSummary> {
  return attachments.reduce((summary, attachment) => {
    const current = summary.get(attachment.entityId) ?? { count: 0, fileName: null };

    summary.set(attachment.entityId, {
      count: current.count + 1,
      fileName: current.fileName ?? attachment.fileName
    });

    return summary;
  }, new Map<string, ExternalPrescriptionAttachmentSummary>());
}

function mapOrder(
  order: OrderWithDetails,
  attachmentSummary: Map<string, ExternalPrescriptionAttachmentSummary>
): PharmacistOrderQueueItem {
  const shipment = order.shipments[0] ?? null;
  const payment = order.payments[0] ?? null;
  const externalPrescription = attachmentSummary.get(order.id) ?? { count: 0, fileName: null };

  return {
    id: order.id,
    orderCode: getOrderCode(order.id),
    customerName: order.user.displayName ?? "LINE customer",
    customerLineId: order.user.lineUserId,
    status: order.status,
    total: formatMoney(order.grandTotal),
    itemSummary: getItemSummary(order),
    externalPrescriptionFileName: externalPrescription.fileName,
    externalPrescriptionAttachmentCount: externalPrescription.count,
    paymentStatus: payment?.status ?? "no_payment_record",
    shipmentStatus: shipment?.status ?? null,
    trackingNumber: shipment?.trackingNumber ?? null,
    createdAt: formatDate(order.createdAt)
  };
}

export async function getPharmacistOrders(): Promise<PharmacistOrdersData> {
  noStore();

  try {
    const orders = await getOrdersForPharmacist();
    const orderIds = orders.map((order) => order.id);
    const attachments = orderIds.length > 0
      ? await prisma.fileAttachment.findMany({
          where: {
            entityType: "order",
            entityId: {
              in: orderIds
            },
            purpose: "external_prescription",
            status: "attached"
          },
          select: {
            entityId: true,
            fileName: true
          }
        })
      : [];
    const attachmentSummary = mapExternalPrescriptionAttachments(attachments);
    const orderItems = orders.map((order) => mapOrder(order, attachmentSummary));

    return {
      orders: orderItems,
      summary: {
        needsPreparation: orderItems.filter((order) => order.status === "paid").length,
        inPreparation: orderItems.filter((order) => order.status === "preparing").length,
        shipped: orderItems.filter((order) => order.status === "shipped").length
      }
    };
  } catch {
    return {
      orders: [],
      summary: {
        needsPreparation: 0,
        inPreparation: 0,
        shipped: 0
      },
      unavailable: true
    };
  }
}
