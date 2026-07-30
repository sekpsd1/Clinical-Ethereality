import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { canReadOwnRecord, hasPermission } from "@/lib/permissions";
import { verifyPaymentSlip } from "@/lib/payments/slip-verification";
import { normalizeHostedAttachmentInput } from "@/lib/storage/attachments";
import { applyProviderPaymentVerification } from "@/features/payments/service";

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

    await prisma.$transaction(async (tx) => {
      await applyProviderPaymentVerification(tx, {
        actorId: session.userId,
        hostedSlipAttachment,
        payment: {
          id: payment.id,
          orderId: order.id,
          orderUserId: order.userId,
          status: payment.status,
          slipImageUrl: payment.slipImageUrl
        },
        result,
        source: parsed.data.qrPayload ? "qr_payload" : "image_url"
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
