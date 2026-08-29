"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { sendConsultationMessageSchema } from "@/features/consultations/chat/schema";
import { canParticipantAccessLiveConsultation } from "@/features/consultations/waiting-room/access";

export type SendConsultationMessageActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function sendConsultationMessageAction(
  _previousState: SendConsultationMessageActionState,
  formData: FormData
): Promise<SendConsultationMessageActionState> {
  const session = await requireCurrentSession();
  const parsed = sendConsultationMessageSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรุณาพิมพ์ข้อความก่อนส่ง"
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const consultation = await tx.consultation.findUnique({
        where: {
          id: parsed.data.consultationId
        },
        select: {
          id: true,
          patientId: true,
          doctorId: true,
          status: true,
          scheduledAt: true,
          doctor: {
            select: {
              userId: true
            }
          }
        }
      });

      if (!consultation) {
        throw new Error("Consultation not found.");
      }

      const canAccess =
        (session.role === "customer" || session.role === "doctor") &&
        canParticipantAccessLiveConsultation(
          {
            userId: session.userId,
            role: session.role
          },
          {
            patientId: consultation.patientId,
            doctorUserId: consultation.doctor.userId,
            status: consultation.status,
            scheduledAt: consultation.scheduledAt
          }
        );

      if (!canAccess) {
        throw new Error("User cannot access this consultation chat.");
      }

      const message = await tx.consultationMessage.create({
        data: {
          consultationId: consultation.id,
          senderId: session.userId,
          body: parsed.data.body
        }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "consultation_message.create",
        entityType: "consultation_message",
        entityId: message.id,
        metadata: {
          consultationId: consultation.id,
          senderRole: session.role
        }
      });

      const recipientId = consultation.patientId === session.userId ? consultation.doctor.userId : consultation.patientId;

      if (recipientId !== session.userId) {
        await tx.notification.create({
          data: {
            userId: recipientId,
            type: "consultation",
            channel: "in_app",
            title: "มีข้อความใหม่ในการปรึกษา",
            body: parsed.data.body,
            metadataJson: {
              consultationId: consultation.id,
              href:
                session.role === "doctor"
                  ? `/consult/live?consultation=${encodeURIComponent(consultation.id)}`
                  : "/doctor/consultations"
            }
          }
        });
      }
    });
  } catch {
    return {
      status: "error",
      message: "ส่งข้อความไม่สำเร็จ กรุณาตรวจสอบสิทธิ์หรือลองใหม่อีกครั้ง"
    };
  }

  revalidatePath("/consult/live");
  revalidatePath("/doctor/consultations");
  revalidatePath("/notifications");

  return {
    status: "success",
    message: "ส่งข้อความแล้ว"
  };
}
