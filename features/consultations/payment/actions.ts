"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { verifyPaymentSlip } from "@/lib/payments/slip-verification";
import { verifyConsultationSlipSchema } from "@/features/consultations/payment/schema";

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

  if (consultation.status !== "pending_payment") {
    redirectToPayment(consultation.id, "invalid");
  }

  const result = await verifyPaymentSlip({
    qrPayload: parsed.data.qrPayload || undefined,
    imageUrl: parsed.data.imageUrl || undefined,
    amount: consultation.doctor.consultationFee ?? 1000
  }).catch(() => null);

  if (!result) {
    redirectToPayment(consultationId, "provider_error");
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (result.ok) {
        await tx.consultation.update({
          where: {
            id: consultation.id
          },
          data: {
            status: "scheduled"
          }
        });

        await tx.notification.create({
          data: {
            userId: session.userId,
            type: "consultation",
            channel: "in_app",
            title: "ยืนยันการชำระค่าปรึกษาแล้ว",
            body: "นัดหมายของคุณได้รับการยืนยันแล้ว กรุณาเปิดห้องรอก่อนเวลานัด",
            metadataJson: {
              consultationId: consultation.id,
              href: `/consult/appointments/${consultation.id}`,
              provider: result.provider,
              transRef: result.transRef
            }
          }
        });
      }

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: result.ok ? "consultation.payment_verified" : "consultation.payment_rejected",
        entityType: "consultation",
        entityId: consultation.id,
        metadata: {
          provider: result.provider,
          status: result.status,
          transRef: result.transRef,
          amount: result.amount,
          receiverName: result.receiverName
        }
      });
    });
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

  redirectToPayment(consultation.id, result.status === "provider_error" ? "provider_error" : "rejected");
}
