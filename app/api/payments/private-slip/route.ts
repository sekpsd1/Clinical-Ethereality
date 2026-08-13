import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/audit-log";
import {
  getPaymentVerificationRetryAfterSeconds,
  isPaymentReadyForProviderVerification,
  mergePaymentVerificationPayload,
  PaymentVerificationConflictError,
  type ProviderPaymentSnapshot
} from "@/features/payments/service";
import {
  getPaymentSlipErrorMessage,
  paymentSlipEntityType,
  PaymentSlipError,
  preparePrivatePaymentSlip
} from "@/features/payments/private-slips";
import {
  isStorePaymentReviewExpired,
  isStoreReservationExpired,
  releaseExpiredStoreOrderReservations
} from "@/features/orders/reservations";
import { verifyUploadedStorePrivateSlip } from "@/features/payments/store-private-slip-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class PrivateSlipSubmissionError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409 | 429 | 503, message: string) {
    super(message);
  }
}

function jsonError(error: unknown): NextResponse {
  if (error instanceof PaymentSlipError) {
    return NextResponse.json({ ok: false, error: getPaymentSlipErrorMessage(error) }, { status: 400 });
  }

  if (error instanceof PrivateSlipSubmissionError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }

  return NextResponse.json({ ok: false, error: "ไม่สามารถรับสลิปเพื่อรอตรวจสอบได้" }, { status: 503 });
}

function isPaymentFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

async function submitStoreSlip(input: {
  actorId: string;
  file: File;
  paymentId: string;
  userId: string;
}) {
  const payment = await prisma.payment.findUnique({
    where: { id: input.paymentId },
    include: {
      order: {
        select: {
          createdAt: true,
          id: true,
          status: true,
          userId: true
        }
      }
    }
  });

  if (!payment?.order) {
    throw new PrivateSlipSubmissionError(404, "ไม่พบรายการชำระเงินของคำสั่งซื้อ");
  }

  const order = payment.order;

  if (input.userId !== order.userId) {
    throw new PrivateSlipSubmissionError(403, "ไม่มีสิทธิ์ส่งสลิปของรายการนี้");
  }

  const now = new Date();
  const reservationExpired =
    order.status === "pending_payment"
      ? isStoreReservationExpired(order.createdAt, now)
      : order.status === "payment_review"
        ? isStorePaymentReviewExpired(order.createdAt, now)
        : false;

  await releaseExpiredStoreOrderReservations({ now, userId: order.userId });

  if (reservationExpired) {
    throw new PrivateSlipSubmissionError(409, "คำสั่งซื้อนี้หมดเวลาชำระเงินแล้ว");
  }

  if (!isPaymentReadyForProviderVerification(payment.status) || payment.status === "pending_review") {
    throw new PrivateSlipSubmissionError(409, "รายการชำระเงินนี้ไม่พร้อมรับสลิปใหม่");
  }

  const retryAfterSeconds = getPaymentVerificationRetryAfterSeconds(payment, now);

  if (retryAfterSeconds > 0) {
    throw new PrivateSlipSubmissionError(429, `กรุณารอ ${retryAfterSeconds} วินาทีก่อนส่งสลิปอีกครั้ง`);
  }

  const prepared = await preparePrivatePaymentSlip({
    file: input.file,
    ownerId: order.userId,
    paymentId: payment.id
  });

  let providerPayment: ProviderPaymentSnapshot;

  try {
    providerPayment = await prisma.$transaction(
      async (tx) => {
        const current = await tx.payment.findUnique({
          where: { id: payment.id },
          select: {
            orderId: true,
            amount: true,
            status: true,
            updatedAt: true,
            verificationPayload: true,
            order: { select: { status: true, userId: true } }
          }
        });

        if (
          !current?.orderId ||
          !current.order ||
          current.order.userId !== order.userId ||
          !isPaymentReadyForProviderVerification(current.status) ||
          current.order.status !== "pending_payment"
        ) {
          throw new PaymentVerificationConflictError();
        }

        const submittedAt = new Date();
        const verificationPayload = mergePaymentVerificationPayload(current.verificationPayload, {
          providerAttempt: {
            claimedAt: submittedAt.toISOString(),
            claimedBy: input.actorId,
            status: "pending_review"
          },
          submittedEvidence: {
            attachmentId: prepared.attachmentId,
            submittedAt: submittedAt.toISOString(),
            type: "private_file"
          },
          submissionSource: "private_file"
        });
        const paymentUpdate = await tx.payment.updateMany({
          where: { id: payment.id, status: current.status, updatedAt: current.updatedAt },
          data: {
            status: "pending_review",
            slipImageUrl: prepared.storageUrl,
            updatedAt: submittedAt,
            verificationPayload
          }
        });

        if (paymentUpdate.count !== 1) {
          throw new PaymentVerificationConflictError();
        }

        const orderUpdate = await tx.order.updateMany({
          where: { id: order.id, status: "pending_payment" },
          data: { status: "payment_review" }
        });

        if (orderUpdate.count !== 1) {
          throw new PaymentVerificationConflictError();
        }

        await tx.fileAttachment.updateMany({
          where: {
            entityId: payment.id,
            entityType: paymentSlipEntityType,
            status: "attached"
          },
          data: { status: "archived" }
        });
        await tx.fileAttachment.create({
          data: {
            id: prepared.attachmentId,
            ownerId: order.userId,
            purpose: "payment_slip",
            status: "attached",
            entityType: paymentSlipEntityType,
            entityId: payment.id,
            storageUrl: prepared.storageUrl,
            storageKey: prepared.storageKey,
            fileName: prepared.fileName,
            mimeType: prepared.mimeType,
            byteSize: prepared.byteSize,
            metadataJson: {
              storageProvider: "plesk_private_local",
              visibility: "private",
              paymentKind: "store"
            }
          }
        });
        await tx.notification.create({
          data: {
            userId: order.userId,
            type: "payment",
            channel: "in_app",
            title: "ได้รับสลิปแล้ว",
            body: "ระบบกำลังตรวจสอบสลิปอัตโนมัติ และจะส่งให้ทีมงานตรวจหากผู้ให้บริการยังไม่พร้อม",
            metadataJson: { orderId: order.id, paymentId: payment.id, href: "/store/orders" }
          }
        });
        await writeAuditLog(tx, {
          actorId: input.actorId,
          action: "payment.private_slip_uploaded",
          entityType: "payment",
          entityId: payment.id,
          metadata: {
            attachmentId: prepared.attachmentId,
            orderId: order.id,
            previousStatus: current.status,
            nextStatus: "pending_review",
            verificationMode: "automatic_provider_with_manual_fallback"
          }
        });

        return {
          id: payment.id,
          orderId: order.id,
          orderUserId: order.userId,
          amount: current.amount,
          status: "pending_review" as const,
          slipImageUrl: prepared.storageUrl,
          verificationPayload: verificationPayload as Prisma.JsonValue,
          updatedAt: submittedAt
        } satisfies ProviderPaymentSnapshot;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    await prepared.cleanup();

    if (error instanceof PaymentVerificationConflictError) {
      throw new PrivateSlipSubmissionError(409, "สถานะการชำระเงินเปลี่ยนแล้ว กรุณารีเฟรชและลองใหม่");
    }

    throw error;
  }

  const verification = await verifyUploadedStorePrivateSlip({
    actorId: input.actorId,
    payment: providerPayment,
    privateSlip: {
      fileName: prepared.fileName,
      mimeType: prepared.mimeType,
      storageKey: prepared.storageKey
    }
  });

  return {
    attachmentId: prepared.attachmentId,
    paymentId: payment.id,
    ...verification
  };
}

async function submitConsultationSlip(input: {
  actorId: string;
  consultationId: string;
  file: File;
  userId: string;
}) {
  const consultation = await prisma.consultation.findUnique({
    where: { id: input.consultationId },
    include: { payment: { select: { id: true, status: true } } }
  });

  if (!consultation) {
    throw new PrivateSlipSubmissionError(404, "ไม่พบรายการปรึกษา");
  }

  if (input.userId !== consultation.patientId) {
    throw new PrivateSlipSubmissionError(403, "ไม่มีสิทธิ์ส่งสลิปของรายการนี้");
  }

  if (consultation.status !== "pending_payment") {
    throw new PrivateSlipSubmissionError(409, "รายการปรึกษานี้ไม่พร้อมรับสลิป");
  }

  const existingPayment = consultation.payment;

  if (
    existingPayment &&
    (!isPaymentReadyForProviderVerification(existingPayment.status) || existingPayment.status === "pending_review")
  ) {
    throw new PrivateSlipSubmissionError(409, "รายการชำระเงินนี้ไม่พร้อมรับสลิปใหม่");
  }

  const prepared = await preparePrivatePaymentSlip({
    file: input.file,
    ownerId: consultation.patientId,
    paymentId: existingPayment?.id ?? `consultation-${consultation.id}`
  });

  try {
    await prisma.$transaction(async (tx) => {
      const currentConsultation = await tx.consultation.findUnique({
        where: { id: consultation.id },
        select: { patientId: true, status: true, doctor: { select: { consultationFee: true } } }
      });

      if (!currentConsultation || currentConsultation.patientId !== consultation.patientId || currentConsultation.status !== "pending_payment") {
        throw new PaymentVerificationConflictError();
      }

      const currentPayment = await tx.payment.findUnique({
        where: { consultationId: consultation.id },
        select: { id: true, status: true, updatedAt: true, verificationPayload: true }
      });

      if (
        currentPayment &&
        (!isPaymentReadyForProviderVerification(currentPayment.status) || currentPayment.status === "pending_review")
      ) {
        throw new PaymentVerificationConflictError();
      }

      const submittedAt = new Date();
      const payment = currentPayment
        ? await tx.payment.update({
            where: { id: currentPayment.id },
            data: {
              status: "pending_review",
              slipImageUrl: prepared.storageUrl,
              verificationPayload: mergePaymentVerificationPayload(currentPayment.verificationPayload, {
                submittedEvidence: {
                  attachmentId: prepared.attachmentId,
                  submittedAt: submittedAt.toISOString(),
                  type: "private_file"
                },
                submissionSource: "private_file"
              })
            },
            select: { id: true }
          })
        : await tx.payment.create({
            data: {
              consultationId: consultation.id,
              amount: currentConsultation.doctor.consultationFee ?? 1000,
              status: "pending_review",
              slipImageUrl: prepared.storageUrl,
              verificationPayload: {
                submittedEvidence: {
                  attachmentId: prepared.attachmentId,
                  submittedAt: submittedAt.toISOString(),
                  type: "private_file"
                },
                submissionSource: "private_file"
              }
            },
            select: { id: true }
          });

      await tx.fileAttachment.updateMany({
        where: { entityId: payment.id, entityType: paymentSlipEntityType, status: "attached" },
        data: { status: "archived" }
      });
      await tx.fileAttachment.create({
        data: {
          id: prepared.attachmentId,
          ownerId: consultation.patientId,
          purpose: "payment_slip",
          status: "attached",
          entityType: paymentSlipEntityType,
          entityId: payment.id,
          storageUrl: prepared.storageUrl,
          storageKey: prepared.storageKey,
          fileName: prepared.fileName,
          mimeType: prepared.mimeType,
          byteSize: prepared.byteSize,
          metadataJson: {
            storageProvider: "plesk_private_local",
            visibility: "private",
            paymentKind: "consultation"
          }
        }
      });
      await tx.notification.create({
        data: {
          userId: consultation.patientId,
          type: "consultation",
          channel: "in_app",
          title: "ได้รับสลิปค่าปรึกษาแล้ว",
          body: "ทีมงานจะตรวจสอบสลิปก่อนยืนยันนัดหมาย",
          metadataJson: { consultationId: consultation.id, paymentId: payment.id, href: `/consult/payment?consultation=${consultation.id}` }
        }
      });
      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "consultation.private_slip_uploaded",
        entityType: "consultation",
        entityId: consultation.id,
        metadata: { attachmentId: prepared.attachmentId, paymentId: payment.id, nextPaymentStatus: "pending_review" }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    await prepared.cleanup();

    if (error instanceof PaymentVerificationConflictError) {
      throw new PrivateSlipSubmissionError(409, "สถานะการชำระเงินเปลี่ยนแล้ว กรุณารีเฟรชและลองใหม่");
    }

    throw error;
  }

  return { attachmentId: prepared.attachmentId, status: "pending_review" as const };
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนส่งสลิป" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file") ?? null;
  const paymentId = String(formData?.get("paymentId") ?? "").trim();
  const consultationId = String(formData?.get("consultationId") ?? "").trim();

  if (!formData || !isPaymentFile(file) || Boolean(paymentId) === Boolean(consultationId)) {
    return NextResponse.json({ ok: false, error: "ข้อมูลอัปโหลดสลิปไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const result = paymentId
      ? await submitStoreSlip({ actorId: session.userId, file, paymentId, userId: session.userId })
      : await submitConsultationSlip({ actorId: session.userId, consultationId, file, userId: session.userId });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}
