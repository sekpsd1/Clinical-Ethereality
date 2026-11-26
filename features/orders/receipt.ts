import type { OrderStatus, Prisma } from "@prisma/client";
import { getPrintableReceiptAccountName, getVerifiedReceipt, receiptPaymentSelect, type ReceiptPayment } from "@/features/consultations/receipt/model";
import { hasReceiptGlyphs } from "@/features/consultations/receipt/font-coverage";
import { ReceiptAccessError } from "@/features/consultations/receipt/queries";
import type { PublicSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { getOrderCode } from "./types";

export const paidOrderReceiptStatuses: OrderStatus[] = ["paid", "preparing", "shipped", "delivered"];

export const orderReceiptSelect = {
  user: { select: { fullName: true, displayName: true } },
  shippingTotal: true,
  discountTotal: true,
  items: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { quantity: true, lineTotal: true, product: { select: { name: true } } }
  }
} satisfies Prisma.OrderSelect;

export async function getOwnedOrderReceipt(session: PublicSession | null, orderId: string) {
  if (!session) throw new ReceiptAccessError(401);
  if (session.role !== "customer" || session.userId.startsWith("dev:") || !session.sessionId) {
    throw new ReceiptAccessError(403);
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: session.userId,
      status: { in: paidOrderReceiptStatuses },
      user: {
        role: "customer", status: "active",
        authSessions: { some: {
          id: session.sessionId, status: "active", revokedAt: null,
          expiresAt: { gt: new Date() }
        } }
      }
    },
    select: {
      ...orderReceiptSelect,
      payments: {
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 1,
        select: receiptPaymentSelect
      }
    }
  });
  return buildOrderReceipt(orderId, order, order?.payments[0]);
}

export function buildOrderReceipt(
  orderId: string,
  order: Prisma.OrderGetPayload<{ select: typeof orderReceiptSelect }> | null,
  payment: ReceiptPayment | undefined
) {
  if (!order || !payment || payment.orderId !== orderId || payment.consultationId !== null) {
    throw new ReceiptAccessError(404);
  }

  const accountName = getPrintableReceiptAccountName(order.user.fullName, order.user.displayName);
  const receipt = getVerifiedReceipt(payment, accountName, "SO");
  if (!receipt) throw new ReceiptAccessError(404);

  const money = (value: { toString(): string }) => Number(value.toString()).toLocaleString("en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  const lines = order.items.map(({ product, quantity, lineTotal }, index) => {
    const name = product.name.replace(/[\p{Cc}\p{Cf}]/gu, " ").trim();
    const label = name && hasReceiptGlyphs(name) ? name : `สินค้า ${index + 1}`;
    return `${label}  จำนวน ${quantity}  ${money(lineTotal)} บาท`;
  });
  if (Number(order.discountTotal) > 0) lines.push(`ส่วนลด ${money(order.discountTotal)} บาท`);
  if (Number(order.shippingTotal) > 0) lines.push(`ค่าจัดส่ง ${money(order.shippingTotal)} บาท`);

  return { receipt, order: { code: getOrderCode(orderId), lines } };
}

export async function getOrderReceiptDetails(session: PublicSession, orderId: string) {
  try {
    return await getOwnedOrderReceipt(session, orderId);
  } catch {
    return null;
  }
}
