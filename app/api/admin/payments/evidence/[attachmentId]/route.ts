import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/permissions";
import {
  getConsultationManualReviewEvidenceAttachmentId
} from "@/features/consultations/payment/manual-review";
import {
  consultationManualReviewEvidenceEntityType,
  readPrivatePaymentSlip
} from "@/features/payments/private-slips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ attachmentId: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }
  if (
    session.role !== "admin" ||
    !hasPermission(session, "consultation-payment:manual-review")
  ) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const activeAdmin = await prisma.user.findFirst({
    where: { id: session.userId, role: "admin", status: "active" },
    select: { id: true }
  });
  if (!activeAdmin) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { attachmentId } = await context.params;
  const attachment = await prisma.fileAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      id: true,
      entityId: true,
      entityType: true,
      mimeType: true,
      ownerId: true,
      purpose: true,
      status: true,
      storageKey: true
    }
  });
  if (
    !attachment ||
    attachment.entityType !== consultationManualReviewEvidenceEntityType ||
    attachment.purpose !== "other" ||
    attachment.status !== "attached" ||
    !attachment.storageKey
  ) {
    return NextResponse.json({ error: "Evidence not found." }, { status: 404 });
  }

  const payment = await prisma.payment.findUnique({
    where: { id: attachment.entityId },
    select: {
      consultationId: true,
      reviewedById: true,
      verificationPayload: true
    }
  });
  if (
    !payment?.consultationId ||
    payment.reviewedById !== attachment.ownerId ||
    getConsultationManualReviewEvidenceAttachmentId(
      payment.verificationPayload
    ) !== attachment.id
  ) {
    return NextResponse.json({ error: "Evidence not found." }, { status: 404 });
  }

  try {
    const bytes = await readPrivatePaymentSlip(attachment.storageKey);
    const body = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;

    return new Response(body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "Content-Type": attachment.mimeType ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Evidence not found." }, { status: 404 });
  }
}
