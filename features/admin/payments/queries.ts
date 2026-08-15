import { unstable_noStore as noStore } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AdminPaymentQueueItem, AdminPaymentsData } from "@/features/admin/payments/types";
import { getManualStoreRefundReadiness } from "@/features/payments/refund-readiness";

type PaymentWithContext = Awaited<ReturnType<typeof getPaymentsForAdmin>>[number];

function getPaymentsForAdmin() {
  return prisma.payment.findMany({
    orderBy: {
      updatedAt: "desc"
    },
    take: 50,
    select: {
      id: true,
      orderId: true,
      consultationId: true,
      amount: true,
      method: true,
      status: true,
      verificationPayload: true,
      createdAt: true,
      reviewedAt: true,
      order: {
        select: {
          user: {
            select: {
              displayName: true,
              phone: true,
              phoneVerifiedAt: true
            }
          },
          items: {
            include: {
              product: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      },
      consultation: {
        select: {
          patient: {
            select: {
              displayName: true,
              phone: true,
              phoneVerifiedAt: true
            }
          },
          doctor: {
            select: {
              user: {
                select: {
                  displayName: true
                }
              }
            }
          }
        }
      }
    }
  });
}

function formatMoney(value: unknown): string {
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Number(value))} บาท`;
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

function getItemSummary(payment: PaymentWithContext): string {
  if (payment.consultation) {
    const doctorName = payment.consultation.doctor.user.displayName ?? "แพทย์ผู้ให้คำปรึกษา";

    return `ค่าปรึกษากับ ${doctorName}`;
  }

  if (!payment.order) {
    return "ไม่พบบริบทของรายการชำระเงิน";
  }

  if (payment.order.items.length === 0) {
    return "ไม่มีรายการสินค้าในคำสั่งซื้อ";
  }

  return payment.order.items.map((item) => `${item.product.name} x${item.quantity}`).join(", ");
}

function asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getProviderLabel(source: string | null): string {
  if (source === "slipok") {
    return "SlipOK";
  }

  if (source === "easyslip") {
    return "EasySlip";
  }

  if (source === "admin_manual_review") {
    return "ตรวจโดยแอดมิน";
  }

  return "ยังไม่ได้ตรวจผ่านผู้ให้บริการ";
}

function getReviewSourceLabel(source: string | null): string {
  const labels: Record<string, string> = {
    admin_manual_review: "แอดมินตรวจเอง",
    customer_checkout_foundation: "รอสลิปจากหน้าชำระเงิน",
    prescription_order: "คำสั่งซื้อจากใบสั่งยาในระบบ",
    external_prescription_order: "คำสั่งซื้อแนบใบสั่งยาภายนอก",
    slipok: "ตรวจผ่าน SlipOK",
    easyslip: "ตรวจผ่าน EasySlip"
  };

  return source ? (labels[source] ?? source) : "ยังไม่มีข้อมูลการตรวจ";
}

function getResultLabel(status: AdminPaymentQueueItem["status"], resultStatus: string | null): string {
  if (resultStatus === "provider_error") {
    return "ผู้ให้บริการตรวจไม่สำเร็จ";
  }

  if (status === "verified") {
    return "ผ่าน";
  }

  if (status === "rejected") {
    return "ไม่ผ่าน";
  }

  if (status === "pending_review") {
    return "รอแอดมินตรวจ";
  }

  if (status === "pending_slip") {
    return "รอสลิป";
  }

  return "คืนเงินแล้ว";
}

function getReceiverLabel(status: AdminPaymentQueueItem["status"]): string {
  if (status === "verified") {
    return "ตรวจสอบผู้รับแล้ว";
  }

  if (status === "rejected") {
    return "ไม่ยืนยันผู้รับ";
  }

  if (status === "refunded") {
    return "ไม่แสดงข้อมูลผู้รับ";
  }

  return "รอการตรวจสอบ";
}

function getPaymentOperationalSummary(payment: PaymentWithContext) {
  const payload = asRecord(payment.verificationPayload);
  const result = asRecord(payload.result as Prisma.JsonValue | null | undefined);
  const source = getString(payload.verificationSource) ?? getString(payload.source);
  const resultStatus = getString(result.status);

  return {
    providerLabel: getProviderLabel(source),
    reviewSourceLabel: getReviewSourceLabel(source),
    resultLabel: getResultLabel(payment.status, resultStatus),
    receiverLabel: getReceiverLabel(payment.status)
  };
}

function mapPayment(payment: PaymentWithContext): AdminPaymentQueueItem {
  const summary = getPaymentOperationalSummary(payment);
  const customer = payment.order?.user ?? payment.consultation?.patient ?? null;
  const referenceId = payment.orderId ?? payment.consultationId ?? payment.id;
  const isConsultationPayment = Boolean(payment.consultationId);

  return {
    id: payment.id,
    orderId: payment.orderId,
    consultationId: payment.consultationId,
    orderCode: isConsultationPayment ? `CONSULT-${referenceId.slice(-6).toUpperCase()}` : getOrderCode(referenceId),
    paymentKindLabel: isConsultationPayment ? "ค่าปรึกษาแพทย์" : "คำสั่งซื้อ",
    canManualReview: Boolean(payment.orderId),
    customerName: customer?.displayName?.trim() || "ผู้ใช้ LINE ยังไม่ระบุชื่อ",
    customerPhone: customer?.phone?.trim() || null,
    customerPhoneVerificationStatus: customer?.phone?.trim()
      ? customer.phoneVerifiedAt ? "verified" : "pending"
      : "not_provided",
    amount: formatMoney(payment.amount),
    refundAmountInput: payment.amount.toString(),
    status: payment.status,
    methodLabel: payment.method === "promptpay" ? "PromptPay" : payment.method,
    providerLabel: summary.providerLabel,
    reviewSourceLabel: summary.reviewSourceLabel,
    resultLabel: summary.resultLabel,
    receiverLabel: summary.receiverLabel,
    itemSummary: getItemSummary(payment),
    submittedAt: formatDate(payment.createdAt) ?? "",
    reviewedAt: formatDate(payment.reviewedAt)
  };
}

export async function getAdminPayments(): Promise<AdminPaymentsData> {
  noStore();

  try {
    const [payments, refundReadiness] = await Promise.all([getPaymentsForAdmin(), getManualStoreRefundReadiness()]);
    const paymentItems = payments.map(mapPayment);

    return {
      payments: paymentItems,
      summary: {
        pendingSlip: paymentItems.filter((payment) => payment.status === "pending_slip").length,
        pendingReview: paymentItems.filter((payment) => payment.status === "pending_review").length,
        verified: paymentItems.filter((payment) => payment.status === "verified").length,
        rejected: paymentItems.filter((payment) => payment.status === "rejected").length
      },
      refundReadiness
    };
  } catch {
    return {
      payments: [],
      summary: {
        pendingSlip: 0,
        pendingReview: 0,
        verified: 0,
        rejected: 0
      },
      refundReadiness: {
        status: "unavailable",
        message: "ไม่สามารถตรวจความพร้อมคืนเงินได้"
      },
      unavailable: true
    };
  }
}
