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

export type ConsultationReceipt = {
  reference: string;
  confirmedAt: Date;
  payerAccountName: string;
  amount: string;
  currency: "THB";
  channel: "PromptPay";
};

export function getReceiptModel(
  payment: ReceiptPayment | null,
  consultationId: string,
  payerAccountName: string | null
): ConsultationReceipt | null {
  if (
    !payment || payment.status !== "verified" || payment.method !== "promptpay" ||
    payment.consultationId !== consultationId || payment.orderId !== null ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(payment.id) ||
    [payment.refundAmount, payment.refundReason, payment.refundedAt, payment.refundedById,
      payment.refundTransactionReference, payment.normalizedRefundReference].some(value => value != null) ||
    !(payment.reviewedAt instanceof Date) || !Number.isFinite(payment.reviewedAt.getTime()) ||
    payment.reviewedAt.getTime() > Date.now() ||
    !payerAccountName?.trim() || payerAccountName.length > 255 ||
    /[\p{Cc}\p{Cf}]/u.test(payerAccountName) || !hasReceiptGlyphs(payerAccountName)
  ) return null;

  // Decimal(10,2), never current Doctor fee, floats or provider payload.
  const amount = payment.amount.toString();
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return null;
  const [whole, fraction = ""] = amount.split(".");
  return {
    reference: `CP-${payment.id}`,
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
