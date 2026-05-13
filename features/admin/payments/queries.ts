import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { AdminPaymentQueueItem, AdminPaymentsData } from "@/features/admin/payments/types";

type PaymentWithOrder = Awaited<ReturnType<typeof getPaymentsForAdmin>>[number];

function getPaymentsForAdmin() {
  return prisma.payment.findMany({
    orderBy: {
      updatedAt: "desc"
    },
    take: 50,
    include: {
      order: {
        include: {
          user: true,
          items: {
            include: {
              product: true
            }
          }
        }
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

function formatDate(date: Date | null): string | null {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getOrderCode(orderId: string): string {
  return `CE-${orderId.slice(-6).toUpperCase()}`;
}

function getItemSummary(payment: PaymentWithOrder): string {
  if (payment.order.items.length === 0) {
    return "ไม่มีรายการสินค้าในคำสั่งซื้อ";
  }

  return payment.order.items.map((item) => `${item.product.name} x${item.quantity}`).join(", ");
}

function mapPayment(payment: PaymentWithOrder): AdminPaymentQueueItem {
  return {
    id: payment.id,
    orderId: payment.orderId,
    orderCode: getOrderCode(payment.orderId),
    customerName: payment.order.user.displayName ?? "ผู้ใช้ LINE ยังไม่ระบุชื่อ",
    customerLineId: payment.order.user.lineUserId,
    amount: formatMoney(payment.amount),
    status: payment.status,
    slipImageUrl: payment.slipImageUrl,
    itemSummary: getItemSummary(payment),
    submittedAt: formatDate(payment.createdAt) ?? "",
    reviewedAt: formatDate(payment.reviewedAt)
  };
}

export async function getAdminPayments(): Promise<AdminPaymentsData> {
  noStore();

  try {
    const payments = await getPaymentsForAdmin();
    const paymentItems = payments.map(mapPayment);

    return {
      payments: paymentItems,
      summary: {
        pendingReview: paymentItems.filter((payment) => payment.status === "pending_review").length,
        verified: paymentItems.filter((payment) => payment.status === "verified").length,
        rejected: paymentItems.filter((payment) => payment.status === "rejected").length
      }
    };
  } catch {
    return {
      payments: [],
      summary: {
        pendingReview: 0,
        verified: 0,
        rejected: 0
      },
      unavailable: true
    };
  }
}
