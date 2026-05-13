import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { canReadOwnRecord, hasPermission } from "@/lib/permissions";
import { verifyPaymentSlip } from "@/lib/payments/slip-verification";

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
    return NextResponse.json({ ok: false, error: "Authentication is required." }, { status: 401 });
  }

  const parsed = verifySlipRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Slip verification request is invalid." }, { status: 400 });
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
    return NextResponse.json({ ok: false, error: "Payment was not found." }, { status: 404 });
  }

  if (!canReadOwnRecord(session, payment.order.userId) && !hasPermission(session, "payment:review")) {
    return NextResponse.json({ ok: false, error: "This payment is not available to the current user." }, { status: 403 });
  }

  if (payment.status !== "pending_review" && payment.status !== "pending_slip") {
    return NextResponse.json({ ok: false, error: "Payment is not ready for slip verification." }, { status: 409 });
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
    });

    return NextResponse.json({
      ok: result.ok,
      result
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Slip verification provider is not configured or unavailable." }, { status: 503 });
  }
}
