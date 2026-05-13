import type { OrderStatus, PaymentStatus, ShipmentStatus } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { PublicSession } from "@/lib/auth/types";
import { getQrDataUrlFromPayload } from "@/lib/payments/promptpay";
import type { CustomerOrderItem, CustomerOrdersData, CustomerOrderTrackingStep } from "@/features/orders/types";

type CustomerOrderRecord = Awaited<ReturnType<typeof getOrdersForCustomer>>[number];

const orderStatusLabels: Record<OrderStatus, string> = {
  pending_payment: "รอชำระเงิน",
  payment_review: "ตรวจสอบสลิป",
  paid: "ชำระเงินแล้ว",
  preparing: "กำลังจัดเตรียม",
  shipped: "จัดส่งแล้ว",
  delivered: "สำเร็จ",
  cancelled: "ยกเลิก",
  refunded: "คืนเงิน"
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending_slip: "รอสลิป",
  pending_review: "รอตรวจสอบ",
  verified: "ยืนยันแล้ว",
  rejected: "ไม่ผ่าน",
  refunded: "คืนเงิน"
};

const shipmentStatusLabels: Record<ShipmentStatus, string> = {
  pending: "รอจัดส่ง",
  preparing: "กำลังเตรียมยา",
  shipped: "จัดส่งแล้ว",
  delivered: "ส่งสำเร็จ",
  failed: "จัดส่งไม่สำเร็จ",
  cancelled: "ยกเลิก"
};

function getOrdersForCustomer(userId: string) {
  return prisma.order.findMany({
    where: {
      userId
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 50,
    include: {
      items: {
        include: {
          product: true,
          prescription: {
            select: {
              status: true
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

function getStatusTone(status: OrderStatus): CustomerOrderItem["statusTone"] {
  if (status === "delivered") {
    return "success";
  }

  if (status === "cancelled" || status === "refunded") {
    return "danger";
  }

  if (status === "pending_payment" || status === "payment_review") {
    return "warning";
  }

  return "neutral";
}

function getStepStatus(
  orderStatus: OrderStatus,
  doneStatuses: readonly OrderStatus[],
  activeStatuses: readonly OrderStatus[]
): CustomerOrderTrackingStep["status"] {
  if (doneStatuses.includes(orderStatus)) {
    return "done";
  }

  if (activeStatuses.includes(orderStatus)) {
    return "active";
  }

  return "pending";
}

function getTrackingSteps(order: CustomerOrderRecord): CustomerOrderTrackingStep[] {
  const payment = order.payments[0] ?? null;
  const shipment = order.shipments[0] ?? null;

  return [
    {
      title: "รับคำสั่งซื้อ",
      description: formatDate(order.createdAt),
      status: "done"
    },
    {
      title: "ตรวจสอบการชำระเงิน",
      description: payment ? paymentStatusLabels[payment.status] : "รอการอัปโหลดสลิป",
      status: getStepStatus(order.status, ["paid", "preparing", "shipped", "delivered"], ["pending_payment", "payment_review"])
    },
    {
      title: "จัดเตรียมโดยเภสัชกร",
      description: shipment ? shipmentStatusLabels[shipment.status] : "รอเข้าสู่คิวห้องยา",
      status: getStepStatus(order.status, ["shipped", "delivered"], ["paid", "preparing"])
    },
    {
      title: "จัดส่ง",
      description: shipment?.trackingNumber ? `เลขพัสดุ: ${shipment.trackingNumber}` : "ยังไม่มีเลขพัสดุ",
      status: getStepStatus(order.status, ["delivered"], ["shipped"])
    }
  ];
}

function getItemSummary(order: CustomerOrderRecord): string {
  if (order.items.length === 0) {
    return "ไม่มีรายการสินค้า";
  }

  return order.items.map((item) => `${item.product.name} x${item.quantity}`).join(", ");
}

async function mapOrder(order: CustomerOrderRecord): Promise<CustomerOrderItem> {
  const payment = order.payments[0] ?? null;
  const shipment = order.shipments[0] ?? null;
  const paymentQrDataUrl = await getQrDataUrlFromPayload(payment?.qrPayload ?? null);

  return {
    id: order.id,
    orderCode: getOrderCode(order.id),
    status: order.status,
    statusLabel: orderStatusLabels[order.status],
    statusTone: getStatusTone(order.status),
    total: formatMoney(order.grandTotal),
    itemSummary: getItemSummary(order),
    itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
    paymentId: payment?.id ?? null,
    paymentStatus: payment?.status ?? null,
    paymentLabel: payment ? paymentStatusLabels[payment.status] : "ยังไม่มีข้อมูลชำระเงิน",
    paymentQrPayload: payment?.qrPayload ?? null,
    paymentQrDataUrl,
    paymentVerificationRequired: payment ? ["pending_slip", "pending_review"].includes(payment.status) : false,
    shipmentStatus: shipment?.status ?? null,
    shipmentLabel: shipment ? shipmentStatusLabels[shipment.status] : "ยังไม่มีข้อมูลจัดส่ง",
    trackingNumber: shipment?.trackingNumber ?? null,
    createdAt: formatDate(order.createdAt),
    updatedAt: formatDate(order.updatedAt),
    steps: getTrackingSteps(order)
  };
}

export async function getCustomerOrders(session: PublicSession): Promise<CustomerOrdersData> {
  noStore();

  try {
    const orders = await getOrdersForCustomer(session.userId);
    const orderItems = await Promise.all(orders.map(mapOrder));

    return {
      orders: orderItems,
      summary: {
        active: orderItems.filter((order) => ["paid", "preparing", "shipped"].includes(order.status)).length,
        paymentReview: orderItems.filter((order) => ["pending_payment", "payment_review"].includes(order.status)).length,
        completed: orderItems.filter((order) => order.status === "delivered").length
      }
    };
  } catch {
    return {
      orders: [],
      summary: {
        active: 0,
        paymentReview: 0,
        completed: 0
      },
      unavailable: true
    };
  }
}
