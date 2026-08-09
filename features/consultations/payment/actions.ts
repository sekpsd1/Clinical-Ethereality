"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";
import { verifyPaymentSlip } from "@/lib/payments/slip-verification";
import { releaseExpiredConsultationSlotLocks } from "@/features/consultations/booking/lock-release";
import { verifyConsultationSlipSchema } from "@/features/consultations/payment/schema";
import { applyConsultationPaymentVerification } from "@/features/consultations/payment/service";
import {
  paymentSlipEntityType,
  readPrivatePaymentSlip,
  validatePaymentSlipContent
} from "@/features/payments/private-slips";
import { paymentSlipMimeTypes, type PaymentSlipMimeType } from "@/features/payments/private-slip-policy";

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectToPayment(consultationId: string, status: string): never {
  redirect(`/consult/payment?consultation=${consultationId}&payment=${status}`);
}

export async function verifyConsultationSlipAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();
  assertPermission(session, "consultation:read:self");

  const parsed = verifyConsultationSlipSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    const consultationId = String(formData.get("consultationId") ?? "");
    redirectToPayment(consultationId, "invalid");
  }

  const consultationId = parsed.data.consultationId;
  await releaseExpiredConsultationSlotLocks();

  const consultation = await prisma.consultation.findFirst({
    where: {
      id: consultationId,
      patientId: session.userId
    },
    include: {
      doctor: {
        select: {
          consultationFee: true
        }
      }
    }
  });

  if (!consultation) {
    redirectToPayment(consultationId, "not_found");
  }

  if (consultation.status === "scheduled" || consultation.status === "live") {
    redirect(`/consult/waiting-room?consultation=${consultation.id}`);
  }

  if (consultation.status === "cancelled") {
    redirectToPayment(consultation.id, "expired");
  }

  if (consultation.status !== "pending_payment") {
    redirectToPayment(consultation.id, "invalid");
  }

  let privateFile: { bytes: Uint8Array; fileName: string; mimeType: PaymentSlipMimeType } | undefined;
  let privateSlipUrl: string | undefined;

  if (parsed.data.attachmentId) {
    const payment = await prisma.payment.findUnique({
      where: { consultationId: consultation.id },
      select: { id: true }
    });
    const attachment = payment
      ? await prisma.fileAttachment.findUnique({
          where: { id: parsed.data.attachmentId },
          select: {
            entityId: true,
            entityType: true,
            fileName: true,
            mimeType: true,
            ownerId: true,
            purpose: true,
            status: true,
            storageKey: true,
            storageUrl: true
          }
        })
      : null;
    const mimeType = attachment?.mimeType as PaymentSlipMimeType | null;

    if (
      !attachment ||
      attachment.entityId !== payment?.id ||
      attachment.entityType !== paymentSlipEntityType ||
      attachment.ownerId !== session.userId ||
      attachment.purpose !== "payment_slip" ||
      attachment.status !== "attached" ||
      !attachment.storageKey ||
      !mimeType ||
      !paymentSlipMimeTypes.includes(mimeType)
    ) {
      redirectToPayment(consultation.id, "invalid");
    }

    try {
      const bytes = await readPrivatePaymentSlip(attachment.storageKey);
      validatePaymentSlipContent(mimeType, bytes);
      privateFile = { bytes, fileName: attachment.fileName, mimeType };
      privateSlipUrl = attachment.storageUrl;
    } catch {
      redirectToPayment(consultation.id, "invalid");
    }
  }

  const result = await verifyPaymentSlip({
    qrPayload: parsed.data.qrPayload || undefined,
    imageUrl: parsed.data.imageUrl || undefined,
    privateFile,
    amount: consultation.doctor.consultationFee ?? 1000
  }).catch(() => null);

  if (!result) {
    redirectToPayment(consultationId, "provider_error");
  }

  if (result.status === "provider_error") {
    redirectToPayment(consultationId, "provider_error");
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await applyConsultationPaymentVerification(tx, {
          actorId: session.userId,
          consultation,
          evidence: {
            amount: consultation.doctor.consultationFee ?? 1000,
            attachmentId: parsed.data.attachmentId,
            qrPayload: parsed.data.qrPayload || undefined,
            slipImageUrl: privateSlipUrl ?? (parsed.data.imageUrl || undefined)
          },
          result
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  } catch {
    redirectToPayment(consultationId, "provider_error");
  }

  revalidatePath(`/consult/appointments/${consultation.id}`);
  revalidatePath("/consult/payment");
  revalidatePath("/consult/waiting-room");
  revalidatePath("/doctor/consultations");
  revalidatePath("/admin");
  revalidatePath("/admin/audit");
  revalidatePath("/notifications");

  if (result.ok) {
    redirect(`/consult/waiting-room?consultation=${consultation.id}`);
  }

  redirectToPayment(consultation.id, "rejected");
}
