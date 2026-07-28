"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { formDataToObject, type FormActionState } from "@/lib/actions/server-actions";
import { resetCustomerAssessmentsSchema } from "@/features/admin/customers/schema";

export type AdminCustomerAssessmentActionState = FormActionState;

export async function resetCustomerAssessmentsAction(
  _previousState: AdminCustomerAssessmentActionState,
  formData: FormData
): Promise<AdminCustomerAssessmentActionState> {
  const session = await requireAdminSession();
  const parsed = resetCustomerAssessmentsSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "คำขอให้ทำแบบประเมินใหม่ไม่ถูกต้อง"
    };
  }

  const now = new Date();

  try {
    const affectedCount = await prisma.$transaction(async (tx) => {
      const customer = await tx.user.findFirst({
        where: {
          id: parsed.data.customerId,
          role: "customer"
        },
        select: {
          id: true
        }
      });

      if (!customer) {
        throw new Error("Customer was not found.");
      }

      const activeAssessments = await tx.consultAssessment.findMany({
        where: {
          userId: customer.id,
          expiresAt: {
            gt: now
          }
        },
        select: {
          id: true
        }
      });

      if (activeAssessments.length === 0) {
        return 0;
      }

      await tx.consultAssessment.updateMany({
        where: {
          id: {
            in: activeAssessments.map((assessment) => assessment.id)
          }
        },
        data: {
          expiresAt: now
        }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "consult_assessment.reset_for_customer",
        entityType: "consult_assessment",
        entityId: activeAssessments[0]?.id ?? null,
        metadata: {
          customerId: customer.id,
          affectedCount: activeAssessments.length,
          resetAt: now.toISOString(),
          assessmentsRemainInHistory: true
        }
      });

      return activeAssessments.length;
    });

    if (affectedCount === 0) {
      return {
        status: "error",
        message: "ลูกค้ารายนี้ไม่มีแบบประเมินที่ยังใช้งานอยู่"
      };
    }
  } catch {
    return {
      status: "error",
      message: "ไม่สามารถให้ลูกค้าทำแบบประเมินใหม่ได้ กรุณาลองอีกครั้ง"
    };
  }

  revalidatePath("/");
  revalidatePath("/consult");
  revalidatePath("/consult/assessment");
  revalidatePath("/consult/assessment/complete");
  revalidatePath("/admin");
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${parsed.data.customerId}`);
  revalidatePath("/admin/audit");

  return {
    status: "success",
    message: "ลูกค้าสามารถทำแบบประเมินใหม่ได้แล้ว โดยประวัติเดิมยังถูกเก็บไว้"
  };
}
