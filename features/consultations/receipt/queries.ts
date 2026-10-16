import type { PublicSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { getReceiptModel } from "./model";

export class ReceiptAccessError extends Error {
  constructor(public readonly status: 401 | 403 | 404) {
    super("Receipt unavailable");
  }
}

/** No clinical fields, raw provider payloads, or writes in this read path. */
export async function getOwnedConsultationReceipt(session: PublicSession | null, consultationId: string) {
  if (!session) throw new ReceiptAccessError(401);
  if (session.role !== "customer" || session.userId.startsWith("dev:") || !session.sessionId) {
    throw new ReceiptAccessError(403);
  }
  const activeUser = await prisma.user.findFirst({
    where: {
      id: session.userId, role: "customer", status: "active",
      authSessions: { some: {
        id: session.sessionId, status: "active", revokedAt: null,
        expiresAt: { gt: new Date() }
      } }
    },
    select: { displayName: true }
  });
  if (!activeUser) throw new ReceiptAccessError(403);
  const payment = await prisma.payment.findFirst({
    where: {
      consultationId, orderId: null,
      consultation: { is: { id: consultationId, patientId: session.userId } }
    },
    select: {
      id: true, consultationId: true, orderId: true, status: true, method: true,
      amount: true, reviewedAt: true, refundAmount: true, refundReason: true,
      refundedAt: true, refundedById: true, refundTransactionReference: true,
      normalizedRefundReference: true
    }
  });
  const receipt = getReceiptModel(payment, consultationId, activeUser.displayName);
  if (!receipt) throw new ReceiptAccessError(404);
  return receipt;
}

export async function getConsultationReceiptHref(session: PublicSession, consultationId: string) {
  try {
    await getOwnedConsultationReceipt(session, consultationId);
    return `/api/consultations/${encodeURIComponent(consultationId)}/receipt`;
  } catch {
    // Missing legacy fields or revoked sessions never advertise an eligible receipt.
    return null;
  }
}
