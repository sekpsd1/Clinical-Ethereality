import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  getPrintableReceiptAccountName, getReceiptModel, isVerifiedReceiptPayment, receiptPaymentSelect, type ReceiptPayment
} from "@/features/consultations/receipt/model";
import { renderConsultationReceipt } from "@/features/consultations/receipt/pdf";
import { buildOrderReceipt, orderReceiptSelect, paidOrderReceiptStatuses } from "@/features/orders/receipt";
import { AdminDocumentAccessError } from "./access";

export function getAdminReceiptHref(payment: ReceiptPayment | null, orderStatus?: OrderStatus) {
  if (!isVerifiedReceiptPayment(payment)) return null;
  const eligible = payment.orderId
    ? payment.consultationId === null && orderStatus && paidOrderReceiptStatuses.includes(orderStatus)
    : Boolean(payment.consultationId);
  return eligible ? `/api/admin/payments/${encodeURIComponent(payment.id)}/receipt` : null;
}

export async function renderAdminPaymentReceipt(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId, status: "verified" },
    select: {
      ...receiptPaymentSelect,
      consultation: { select: { patient: { select: { fullName: true, displayName: true } } } },
      order: { select: { ...orderReceiptSelect, status: true } }
    }
  });
  if (!payment || !getAdminReceiptHref(payment, payment.order?.status)) {
    throw new AdminDocumentAccessError(404);
  }

  if (payment.orderId) {
    const { receipt, order } = buildOrderReceipt(payment.orderId, payment.order, payment);
    return { bytes: await renderConsultationReceipt(receipt, order), filename: "store-payment-receipt.pdf" };
  }

  const patient = payment.consultation?.patient;
  if (!patient || !payment.consultationId) throw new AdminDocumentAccessError(404);
  const name = getPrintableReceiptAccountName(patient.fullName, patient.displayName);
  const receipt = getReceiptModel(payment, payment.consultationId, name);
  if (!receipt) throw new AdminDocumentAccessError(404);
  return { bytes: await renderConsultationReceipt(receipt), filename: "consultation-payment-receipt.pdf" };
}
