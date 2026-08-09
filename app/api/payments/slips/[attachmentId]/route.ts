import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/permissions";
import { paymentSlipEntityType, readPrivatePaymentSlip } from "@/features/payments/private-slips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ attachmentId: string }> }
) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { attachmentId } = await context.params;
  const attachment = await prisma.fileAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      entityId: true,
      entityType: true,
      mimeType: true,
      ownerId: true,
      status: true,
      storageKey: true
    }
  });

  if (
    !attachment ||
    attachment.status !== "attached" ||
    attachment.entityType !== paymentSlipEntityType ||
    !attachment.storageKey
  ) {
    return NextResponse.json({ error: "Slip not found." }, { status: 404 });
  }

  const payment = await prisma.payment.findUnique({
    where: { id: attachment.entityId },
    select: {
      order: { select: { userId: true } },
      consultation: { select: { patientId: true } }
    }
  });
  const ownerId = payment?.order?.userId ?? payment?.consultation?.patientId ?? null;
  const canRead = ownerId === session.userId || hasPermission(session, "payment:review");

  if (!ownerId || attachment.ownerId !== ownerId || !canRead) {
    // Do not reveal whether a payment slip exists to another customer.
    return NextResponse.json({ error: "Slip not found." }, { status: 404 });
  }

  try {
    const bytes = await readPrivatePaymentSlip(attachment.storageKey);
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    return new Response(body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "Content-Type": attachment.mimeType ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Slip not found." }, { status: 404 });
  }
}
