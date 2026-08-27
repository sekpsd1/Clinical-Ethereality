"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { actionError, actionSuccess, formDataToObject, type FormActionState } from "@/lib/actions/server-actions";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { requireAdminSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";
import { updateConsultationFeeSchema } from "@/features/admin/consultation-fees/schema";

export type AdminConsultationFeeActionState = FormActionState;

class ConsultationFeeConflictError extends Error {}
class ConsultationFeeDoctorIneligibleError extends Error {}

export async function updateConsultationFeeAction(
  _previousState: AdminConsultationFeeActionState,
  formData: FormData
): Promise<AdminConsultationFeeActionState> {
  const session = await requireAdminSession();
  assertPermission(session, "admin:access");

  const parsed = updateConsultationFeeSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return actionError("ข้อมูลค่าปรึกษาไม่ถูกต้อง กรุณาตรวจสอบจำนวนเงิน", parsed.error);
  }

  const consultationFeeBaht = parsed.data.consultationFee / 100;
  const expectedUpdatedAt = new Date(parsed.data.expectedUpdatedAt);

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const doctor = await tx.doctor.findUnique({
          where: { id: parsed.data.doctorId },
          select: {
            id: true,
            consultationFee: true,
            status: true,
            updatedAt: true,
            user: {
              select: { status: true }
            }
          }
        });

        if (!doctor || doctor.status !== "approved" || doctor.user.status !== "active") {
          throw new ConsultationFeeDoctorIneligibleError();
        }

        if (doctor.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
          throw new ConsultationFeeConflictError();
        }

        if (doctor.consultationFee === consultationFeeBaht) {
          return { unchanged: true };
        }

        const updated = await tx.doctor.updateMany({
          where: {
            id: doctor.id,
            status: "approved",
            consultationFee: doctor.consultationFee,
            updatedAt: doctor.updatedAt,
            user: { status: "active" }
          },
          data: {
            consultationFee: consultationFeeBaht
          }
        });

        if (updated.count !== 1) {
          throw new ConsultationFeeConflictError();
        }

        await writeAuditLog(tx, {
          actorId: session.userId,
          action: "doctor.consultation_fee.update",
          entityType: "doctor",
          entityId: doctor.id,
          metadata: {
            oldAmountSatang: doctor.consultationFee === null ? null : doctor.consultationFee * 100,
            newAmountSatang: parsed.data.consultationFee
          }
        });

        return { unchanged: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    revalidatePath("/admin");
    revalidatePath("/admin/schedules");
    revalidatePath("/admin/audit");
    revalidatePath("/consult");
    revalidatePath("/consult/booking/somchai");
    revalidatePath("/consult/payment");

    return actionSuccess(
      result.unchanged ? "ค่าปรึกษาเป็นจำนวนนี้อยู่แล้ว จึงไม่มีการเปลี่ยนแปลง" : "อัปเดตค่าปรึกษาและบันทึก Audit Log แล้ว"
    );
  } catch (error) {
    if (
      error instanceof ConsultationFeeConflictError ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")
    ) {
      return actionError("ข้อมูลแพทย์มีการเปลี่ยนแปลง กรุณารีเฟรชหน้าแล้วตรวจสอบค่าล่าสุดก่อนบันทึกอีกครั้ง");
    }

    if (error instanceof ConsultationFeeDoctorIneligibleError) {
      return actionError("ปรับค่าปรึกษาได้เฉพาะแพทย์ที่อนุมัติแล้วและมีบัญชีใช้งานอยู่");
    }

    return actionError("ไม่สามารถอัปเดตค่าปรึกษาได้ กรุณาตรวจสอบฐานข้อมูลแล้วลองใหม่");
  }
}
