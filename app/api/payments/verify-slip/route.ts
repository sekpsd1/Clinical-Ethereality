import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { canReadOwnRecord, hasPermission } from "@/lib/permissions";
import { verifyPaymentSlip } from "@/lib/payments/slip-verification";
import { normalizeHostedAttachmentInput } from "@/lib/storage/attachments";
import { hasExactlyOnePaymentEvidence } from "@/features/payments/evidence";
import {
  paymentSlipEntityType,
  readPrivatePaymentSlip,
  validatePaymentSlipContent
} from "@/features/payments/private-slips";
import { paymentSlipMimeTypes, type PaymentSlipMimeType } from "@/features/payments/private-slip-policy";
import {
  isStorePaymentReviewExpired,
  isStoreReservationExpired,
  releaseExpiredStoreOrderReservations
} from "@/features/orders/reservations";
import {
  applyProviderPaymentVerification,
  claimProviderPaymentVerification,
  DuplicatePaymentTransactionError,
  PaymentVerificationConflictError,
  PaymentVerificationRateLimitError
} from "@/features/payments/service";

export const dynamic = "force-dynamic";

const verifySlipRequestSchema = z
  .object({
    paymentId: z.string().trim().min(1).max(191),
    qrPayload: z.string().trim().min(1).max(4096).optional(),
    imageUrl: z.string().trim().max(2048).url().optional(),
    attachmentId: z.string().trim().min(1).max(191).optional()
  })
  .refine(hasExactlyOnePaymentEvidence, {
    message: "Exactly one of qrPayload, imageUrl, or attachmentId is required."
  });

function isPrismaWriteConflict(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2034"
  );
}

function getPaymentVerificationErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof PaymentVerificationRateLimitError) {
    return NextResponse.json(
      { ok: false, error: `กรุณารอ ${error.retryAfterSeconds} วินาทีก่อนส่งสลิปเพื่อตรวจสอบอีกครั้ง` },
      {
        status: 429,
        headers: {
          "Retry-After": String(error.retryAfterSeconds)
        }
      }
    );
  }

  if (error instanceof PaymentVerificationConflictError || isPrismaWriteConflict(error)) {
    return NextResponse.json(
      { ok: false, error: "สถานะการชำระเงินเปลี่ยนแล้ว กรุณารีเฟรชและตรวจสอบอีกครั้ง" },
      { status: 409 }
    );
  }

  return null;
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนตรวจสอบสลิป" }, { status: 401 });
  }

  const parsed = verifySlipRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "ข้อมูลตรวจสอบสลิปไม่ถูกต้อง" }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({
    where: {
      id: parsed.data.paymentId
    },
    include: {
      order: {
        select: {
          id: true,
          userId: true,
          status: true,
          createdAt: true
        }
      }
    }
  });

  if (!payment) {
    return NextResponse.json({ ok: false, error: "ไม่พบรายการชำระเงินนี้" }, { status: 404 });
  }

  if (!payment.order) {
    return NextResponse.json(
      { ok: false, error: "รายการค่าปรึกษาต้องตรวจผ่านขั้นตอนชำระค่าปรึกษา" },
      { status: 409 }
    );
  }
  const order = payment.order;

  if (!canReadOwnRecord(session, order.userId) && !hasPermission(session, "payment:review")) {
    return NextResponse.json({ ok: false, error: "ผู้ใช้ปัจจุบันไม่มีสิทธิ์ตรวจสอบรายการชำระเงินนี้" }, { status: 403 });
  }

  const verificationRequestedAt = new Date();
  const reservationExpired =
    order.status === "pending_payment"
      ? isStoreReservationExpired(order.createdAt, verificationRequestedAt)
      : order.status === "payment_review"
        ? isStorePaymentReviewExpired(order.createdAt, verificationRequestedAt)
        : false;

  try {
    await releaseExpiredStoreOrderReservations({
      now: verificationRequestedAt,
      userId: order.userId
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "ไม่สามารถตรวจสอบอายุการจองสินค้าได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 503 }
    );
  }

  if (reservationExpired) {
    return NextResponse.json(
      { ok: false, error: "คำสั่งซื้อนี้หมดเวลาชำระเงินและคืนสต็อกแล้ว กรุณาสร้างคำสั่งซื้อใหม่" },
      { status: 409 }
    );
  }

  let hostedSlipAttachment: ReturnType<typeof normalizeHostedAttachmentInput> | null = null;
  let privateFile: { bytes: Uint8Array; fileName: string; mimeType: PaymentSlipMimeType } | null = null;

  if (parsed.data.imageUrl) {
    try {
      hostedSlipAttachment = normalizeHostedAttachmentInput({
        storageUrl: parsed.data.imageUrl,
        fileName: `payment-${payment.id}-slip`
      });
    } catch {
      return NextResponse.json({ ok: false, error: "URL รูปสลิปอยู่นอก storage base URL ที่ตั้งไว้" }, { status: 400 });
    }
  }

  if (parsed.data.attachmentId) {
    const attachment = await prisma.fileAttachment.findUnique({
      where: { id: parsed.data.attachmentId },
      select: {
        entityId: true,
        entityType: true,
        fileName: true,
        mimeType: true,
        ownerId: true,
        purpose: true,
        status: true,
        storageKey: true
      }
    });
    const mimeType = attachment?.mimeType as PaymentSlipMimeType | null;

    if (
      !attachment ||
      attachment.entityId !== payment.id ||
      attachment.entityType !== paymentSlipEntityType ||
      attachment.ownerId !== order.userId ||
      attachment.purpose !== "payment_slip" ||
      attachment.status !== "attached" ||
      !attachment.storageKey ||
      !mimeType ||
      !paymentSlipMimeTypes.includes(mimeType)
    ) {
      // Do not reveal attachment existence or private storage details.
      return NextResponse.json({ ok: false, error: "ไม่พบหลักฐานสลิปส่วนตัว" }, { status: 404 });
    }

    try {
      const bytes = await readPrivatePaymentSlip(attachment.storageKey);
      validatePaymentSlipContent(mimeType, bytes);
      privateFile = { bytes, fileName: attachment.fileName, mimeType };
    } catch {
      return NextResponse.json({ ok: false, error: "ไม่พบหลักฐานสลิปส่วนตัว" }, { status: 404 });
    }
  }

  let claimedPayment: Awaited<ReturnType<typeof claimProviderPaymentVerification>>;

  try {
    claimedPayment = await prisma.$transaction(
      async (tx) =>
        claimProviderPaymentVerification(tx, {
          actorId: session.userId,
          expectedOrderId: order.id,
          expectedOrderUserId: order.userId,
          hostedSlipAttachment,
          privateSlipAttachmentId: parsed.data.attachmentId ?? null,
          paymentId: payment.id,
          qrPayload: parsed.data.qrPayload ?? null,
          source: parsed.data.qrPayload ? "qr_payload" : parsed.data.imageUrl ? "image_url" : "private_file"
        }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  } catch (error) {
    const errorResponse = getPaymentVerificationErrorResponse(error);

    return (
      errorResponse ??
      NextResponse.json(
        { ok: false, error: "ไม่สามารถบันทึกหลักฐานการชำระเงินเพื่อเริ่มตรวจสอบได้" },
        { status: 503 }
      )
    );
  }

  try {
    const result = await verifyPaymentSlip({
      qrPayload: parsed.data.qrPayload,
      imageUrl: parsed.data.imageUrl,
      privateFile: privateFile ?? undefined,
      amount: Number(claimedPayment.amount)
    });

    if (result.status === "provider_error") {
      return NextResponse.json(
        { ok: false, error: "บันทึกหลักฐานแล้ว แต่ผู้ให้บริการยังไม่พร้อม รายการจะคงอยู่ในสถานะรอตรวจสอบโดยแอดมิน" },
        { status: 503 }
      );
    }

    await prisma.$transaction(
      async (tx) => {
        await applyProviderPaymentVerification(tx, {
          actorId: session.userId,
          payment: claimedPayment,
          result,
          source: parsed.data.qrPayload ? "qr_payload" : parsed.data.imageUrl ? "image_url" : "private_file"
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );

    return NextResponse.json({
      ok: result.ok,
      status: result.status
    });
  } catch (error) {
    if (error instanceof DuplicatePaymentTransactionError) {
      return NextResponse.json(
        { ok: false, error: "สลิปนี้ถูกใช้ยืนยันรายการชำระเงินอื่นแล้ว กรุณาใช้สลิปของคำสั่งซื้อนี้" },
        { status: 409 }
      );
    }

    const errorResponse = getPaymentVerificationErrorResponse(error);

    if (errorResponse) {
      return errorResponse;
    }

    return NextResponse.json({ ok: false, error: "Slip verification provider ยังไม่พร้อมใช้งานหรือยังไม่ได้ตั้งค่า" }, { status: 503 });
  }
}
