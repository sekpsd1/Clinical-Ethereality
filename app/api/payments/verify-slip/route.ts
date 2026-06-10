import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { canReadOwnRecord, hasPermission } from "@/lib/permissions";
import { verifyPaymentSlip } from "@/lib/payments/slip-verification";
import { buildAttachmentMetadata, normalizeHostedAttachmentInput } from "@/lib/storage/attachments";

export const dynamic = "force-dynamic";

const verifySlipRequestSchema = z
  .object({
    paymentId: z.string().min(1),
    qrPayload: z.string().min(1).optional(),
    imageUrl: z.string().url().optional()
  })
  .refine((value) => value.qrPayload || value.imageUrl, {
    message: "qrPayload or imageUrl is required."
  });

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
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
          userId: true
        }
      }
    }
  });

  if (!payment) {
    return NextResponse.json({ ok: false, error: "ไม่พบรายการชำระเงินนี้" }, { status: 404 });
  }

  if (!canReadOwnRecord(session, payment.order.userId) && !hasPermission(session, "payment:review")) {
    return NextResponse.json({ ok: false, error: "ผู้ใช้ปัจจุบันไม่มีสิทธิ์ตรวจสอบรายการชำระเงินนี้" }, { status: 403 });
  }

  if (payment.status !== "pending_review" && payment.status !== "pending_slip") {
    return NextResponse.json({ ok: false, error: "รายการชำระเงินนี้ยังไม่พร้อมสำหรับตรวจสอบสลิป" }, { status: 409 });
  }

  let hostedSlipAttachment: ReturnType<typeof normalizeHostedAttachmentInput> | null = null;

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

  try {
    const result = await verifyPaymentSlip({
      qrPayload: parsed.data.qrPayload,
      imageUrl: parsed.data.imageUrl,
      amount: Number(payment.amount)
    });
    const reviewedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: {
          id: payment.id
        },
        data: {
          status: result.ok ? "verified" : "rejected",
          slipImageUrl: hostedSlipAttachment?.storageUrl ?? payment.slipImageUrl,
          reviewedAt,
          verificationPayload: {
            reviewedAt: reviewedAt.toISOString(),
            source: result.provider,
            result: toJsonValue(result)
          }
        }
      });

      await tx.order.update({
        where: {
          id: payment.order.id
        },
        data: {
          status: result.ok ? "paid" : "pending_payment"
        }
      });

      await tx.notification.create({
        data: {
          userId: payment.order.userId,
          type: "payment",
          channel: "in_app",
          title: result.ok ? "ตรวจสอบสลิปสำเร็จ" : "ตรวจสอบสลิปไม่ผ่าน",
          body: result.ok ? "ระบบยืนยันการชำระเงินของคุณแล้ว" : "กรุณาตรวจสอบสลิปและส่งใหม่อีกครั้ง",
          metadataJson: {
            paymentId: payment.id,
            orderId: payment.order.id,
            href: "/store/orders"
          }
        }
      });

      if (hostedSlipAttachment) {
        const existingAttachment = await tx.fileAttachment.findFirst({
          where: {
            purpose: "payment_slip",
            entityType: "payment",
            entityId: payment.id,
            storageUrl: hostedSlipAttachment.storageUrl
          },
          select: {
            id: true
          }
        });

        if (!existingAttachment) {
          await tx.fileAttachment.create({
            data: {
              ownerId: payment.order.userId,
              purpose: "payment_slip",
              entityType: "payment",
              entityId: payment.id,
              storageUrl: hostedSlipAttachment.storageUrl,
              storageKey: hostedSlipAttachment.storageKey,
              fileName: hostedSlipAttachment.fileName,
              mimeType: hostedSlipAttachment.mimeType,
              byteSize: hostedSlipAttachment.byteSize,
              metadataJson: buildAttachmentMetadata(hostedSlipAttachment, {
                orderId: payment.order.id,
                source: "payment_slip_verification"
              })
            }
          });
        }
      }

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "payment.provider_verify_slip",
        entityType: "payment",
        entityId: payment.id,
        metadata: {
          orderId: payment.order.id,
          provider: result.provider,
          ok: result.ok,
          source: parsed.data.qrPayload ? "qr_payload" : "image_url"
        }
      });
    });

    return NextResponse.json({
      ok: result.ok,
      result
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Slip verification provider ยังไม่พร้อมใช้งานหรือยังไม่ได้ตั้งค่า" }, { status: 503 });
  }
}
