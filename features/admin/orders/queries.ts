import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type {
  AdminOrderFulfillmentHistoryItem,
  AdminOrderQueueItem,
  AdminOrdersData
} from "@/features/admin/orders/types";
import { formatPrescriptionItem, parsePrescriptionItems } from "@/features/prescriptions/items";

type OrderWithDetails = Awaited<ReturnType<typeof getOrdersForAdmin>>[number];
type ExternalPrescriptionAttachmentSummary = {
  count: number;
  fileName: string | null;
};
type FulfillmentHistoryByOrder = Map<string, AdminOrderFulfillmentHistoryItem[]>;

const fulfillmentAuditActions = [
  "order.mark_preparing",
  "order.mark_shipped",
  "order.mark_delivered"
] as const;

function getOrdersForAdmin() {
  return prisma.order.findMany({
    orderBy: {
      updatedAt: "desc"
    },
    take: 50,
    include: {
      user: {
        select: {
          displayName: true,
          phone: true
        }
      },
      items: {
        include: {
          product: true,
          prescription: {
            include: {
              doctor: {
                include: {
                  user: true
                }
              }
            }
          }
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
      },
      shippingAddress: true
    }
  });
}

function formatMoney(value: unknown): string {
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Number(value))} บาท`;
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
    return "ไม่มีรายการสินค้าในคำสั่งซื้อ";
  }

  return order.items.map((item) => `${item.product.name} x${item.quantity}`).join(", ");
}

function getPrescriptionSummary(order: OrderWithDetails): {
  doctorName: string | null;
  summary: string | null;
} {
  const prescriptions = Array.from(
    new Map(
      order.items.flatMap((item) =>
        item.prescription ? [[item.prescription.id, item.prescription] as const] : []
      )
    ).values()
  );

  if (prescriptions.length === 0) {
    return {
      doctorName: null,
      summary: null
    };
  }

  return {
    doctorName: prescriptions
      .map((prescription) => prescription.doctor.user.displayName ?? "แพทย์")
      .join(", "),
    summary:
      prescriptions
        .flatMap((prescription) => parsePrescriptionItems(prescription.itemsJson))
        .map(formatPrescriptionItem)
        .join("\n") || null
  };
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
  attachmentSummary: Map<string, ExternalPrescriptionAttachmentSummary>,
  fulfillmentHistory: FulfillmentHistoryByOrder
): AdminOrderQueueItem {
  const shipment = order.shipments[0] ?? null;
  const payment = order.payments[0] ?? null;
  const externalPrescription = attachmentSummary.get(order.id) ?? { count: 0, fileName: null };
  const prescription = getPrescriptionSummary(order);

  return {
    id: order.id,
    orderCode: getOrderCode(order.id),
    customerName: order.user.displayName?.trim() || "ผู้ใช้ LINE ยังไม่ระบุชื่อ",
    customerPhone: order.user.phone?.trim() || null,
    status: order.status,
    total: formatMoney(order.grandTotal),
    itemSummary: getItemSummary(order),
    prescriptionDoctorName: prescription.doctorName,
    prescriptionSummary: prescription.summary,
    externalPrescriptionFileName: externalPrescription.fileName,
    externalPrescriptionAttachmentCount: externalPrescription.count,
    paymentStatus: payment?.status ?? "ไม่มีข้อมูลชำระเงิน",
    shippingAddress: order.shippingAddress ? {
      label: order.shippingAddress.label,
      recipientName: order.shippingAddress.recipientName,
      phone: order.shippingAddress.phone,
      addressLine1: order.shippingAddress.addressLine1,
      addressLine2: order.shippingAddress.addressLine2,
      subdistrict: order.shippingAddress.subdistrict,
      district: order.shippingAddress.district,
      province: order.shippingAddress.province,
      postalCode: order.shippingAddress.postalCode
    } : null,
    shipmentId: shipment?.id ?? null,
    shipmentStatus: shipment?.status ?? null,
    trackingNumber: shipment?.trackingNumber ?? null,
    createdAt: formatDate(order.createdAt),
    fulfillmentHistory: fulfillmentHistory.get(order.id) ?? []
  };
}

function mapFulfillmentHistory(
  auditLogs: Array<{
    action: string;
    entityId: string | null;
    createdAt: Date;
    actor: {
      displayName: string | null;
      role: string;
    } | null;
  }>
): FulfillmentHistoryByOrder {
  return auditLogs.reduce((history, auditLog) => {
    if (!auditLog.entityId || !fulfillmentAuditActions.includes(auditLog.action as (typeof fulfillmentAuditActions)[number])) {
      return history;
    }

    const items = history.get(auditLog.entityId) ?? [];
    items.push({
      action: auditLog.action as AdminOrderFulfillmentHistoryItem["action"],
      actorName:
        auditLog.actor?.displayName ??
        (auditLog.actor?.role === "admin" ? "แอดมิน" : "บัญชีระบบ"),
      actorRole: auditLog.actor?.role ?? null,
      occurredAt: formatDate(auditLog.createdAt)
    });
    history.set(auditLog.entityId, items);

    return history;
  }, new Map<string, AdminOrderFulfillmentHistoryItem[]>());
}

export async function getAdminOrders(): Promise<AdminOrdersData> {
  noStore();

  try {
    const orders = await getOrdersForAdmin();
    const orderIds = orders.map((order) => order.id);
    const [attachments, fulfillmentAuditLogs] = orderIds.length > 0
      ? await Promise.all([
          prisma.fileAttachment.findMany({
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
          }),
          prisma.auditLog.findMany({
            where: {
              action: {
                in: [...fulfillmentAuditActions]
              },
              entityType: "order",
              entityId: {
                in: orderIds
              }
            },
            orderBy: {
              createdAt: "asc"
            },
            select: {
              action: true,
              entityId: true,
              createdAt: true,
              actor: {
                select: {
                  displayName: true,
                  role: true
                }
              }
            }
          })
        ])
      : [[], []];
    const attachmentSummary = mapExternalPrescriptionAttachments(attachments);
    const fulfillmentHistory = mapFulfillmentHistory(fulfillmentAuditLogs);
    const orderItems = orders.map((order) => mapOrder(order, attachmentSummary, fulfillmentHistory));

    return {
      orders: orderItems,
      summary: {
        needsPreparation: orderItems.filter((order) => order.status === "paid").length,
        inFulfillment: orderItems.filter((order) => order.status === "preparing").length,
        shipped: orderItems.filter((order) => order.status === "shipped").length
      }
    };
  } catch {
    return {
      orders: [],
      summary: {
        needsPreparation: 0,
        inFulfillment: 0,
        shipped: 0
      },
      unavailable: true
    };
  }
}
