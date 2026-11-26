import { hasReceiptGlyphs } from "./font-coverage";

/** App payment receipt, not a tax invoice or immutable issuance snapshot. */
export const receiptIssuer = {
  name: "บางกอกไซโตเจเนติกส์คลินิก เฉพาะทางด้านเวชกรรมสูตินรีเวช",
  address: "65/18 ซอยโชคชัยร่วมมิตร แขวงจอมพล เขตจตุจักร กรุงเทพมหานคร 10900"
} as const;

export type ReceiptPayment = {
  id: string;
  consultationId: string | null;
  orderId: string | null;
  status: string;
  method: string;
  amount: { toString(): string };
  reviewedAt: Date | null;
  refundAmount: unknown;
  refundReason: string | null;
  refundedAt: Date | null;
  refundedById: string | null;
  refundTransactionReference: string | null;
  normalizedRefundReference: string | null;
};

export const receiptPaymentSelect = {
  id: true, consultationId: true, orderId: true, status: true, method: true,
  amount: true, reviewedAt: true, refundAmount: true, refundReason: true,
  refundedAt: true, refundedById: true, refundTransactionReference: true,
  normalizedRefundReference: true
} as const;

export type ConsultationReceipt = {
  reference: string;
  confirmedAt: Date;
  payerAccountName: string;
  amount: string;
  currency: "THB";
  channel: "PromptPay";
};

export function getPrintableReceiptAccountName(...names: (string | null | undefined)[]): string {
  return names
    .map(name => name?.trim())
    .find(name => name && name.length <= 255 && !/[\p{Cc}\p{Cf}]/u.test(name) && hasReceiptGlyphs(name))
    ?? "ไม่สามารถแสดงชื่อบัญชีในเอกสาร";
}

export function getReceiptModel(
  payment: ReceiptPayment | null,
  consultationId: string,
  payerAccountName: string | null
): ConsultationReceipt | null {
  if (payment?.consultationId !== consultationId || payment.orderId !== null) return null;
  return getVerifiedReceipt(payment, payerAccountName, "CP");
}

export function isVerifiedReceiptPayment(payment: ReceiptPayment | null): payment is ReceiptPayment & { reviewedAt: Date } {
  if (
    !payment || payment.status !== "verified" || payment.method !== "promptpay" ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(payment.id) ||
    [payment.refundAmount, payment.refundReason, payment.refundedAt, payment.refundedById,
      payment.refundTransactionReference, payment.normalizedRefundReference].some(value => value != null) ||
    !(payment.reviewedAt instanceof Date) || !Number.isFinite(payment.reviewedAt.getTime()) ||
    payment.reviewedAt.getTime() > Date.now()
  ) return false;

  // Decimal(10,2), never current Doctor fee, floats or provider payload.
  const amount = payment.amount.toString();
  return /^\d{1,8}(?:\.\d{1,2})?$/.test(amount) && Number(amount) > 0;
}

export function getVerifiedReceipt(
  payment: ReceiptPayment | null,
  payerAccountName: string | null,
  prefix: "CP" | "SO"
): ConsultationReceipt | null {
  if (
    !isVerifiedReceiptPayment(payment) ||
    !payerAccountName?.trim() || payerAccountName.length > 255 ||
    /[\p{Cc}\p{Cf}]/u.test(payerAccountName) || !hasReceiptGlyphs(payerAccountName)
  ) return null;

  const [whole, fraction = ""] = payment.amount.toString().split(".");
  return {
    reference: `${prefix}-${payment.id}`,
    confirmedAt: payment.reviewedAt,
    payerAccountName: payerAccountName.trim(),
    amount: `${whole}.${fraction.padEnd(2, "0")}`,
    currency: "THB",
    channel: "PromptPay"
  };
}

export function formatReceiptDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "long", timeStyle: "short", timeZone: "Asia/Bangkok"
  }).format(date);
}
