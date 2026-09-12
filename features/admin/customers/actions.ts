"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { formDataToObject, type FormActionState } from "@/lib/actions/server-actions";
import {
  customerTestResetSchema,
  previewCustomerTestResetSchema,
  resetCustomerAssessmentsSchema
} from "@/features/admin/customers/schema";
import { getActiveConsultAssessmentWhere } from "@/features/consultations/assessment/validity";
import { assertPermission } from "@/lib/permissions";
import {
  CustomerTestResetError,
  cleanupCustomerTestResetFiles,
  previewCustomerTestReset,
  resetCustomerTestAccount,
  type CustomerTestResetPreview
} from "@/features/admin/customers/test-reset-service";

export type AdminCustomerAssessmentActionState = FormActionState;

export type AdminCustomerTestResetActionState = FormActionState & {
  preview?: CustomerTestResetPreview;
};

async function requireCustomerTestResetAdmin() {
  const session = await requireAdminSession();
  assertPermission(session, "customer:test-reset");
  return session;
}

export async function previewCustomerTestResetAction(
  _previousState: AdminCustomerTestResetActionState,
  formData: FormData
): Promise<AdminCustomerTestResetActionState> {
  await requireCustomerTestResetAdmin();
  const parsed = previewCustomerTestResetSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return { status: "error", message: "บัญชีลูกค้าที่เลือกไม่ถูกต้อง" };
  }

  try {
    const preview = await prisma.$transaction(
      (tx) => previewCustomerTestReset(tx, parsed.data.customerId),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (preview.code === "eligible") {
      return {
        status: "success",
        message: "ตรวจสอบแล้ว: บัญชีนี้พร้อมรีเซ็ตเป็นผู้ใช้ใหม่",
        preview
      };
    }

    return {
      status: "error",
      message:
        preview.code === "staff_profile_present"
          ? "บัญชีนี้มีประวัติสิทธิ์บุคลากร จึงไม่สามารถใช้การรีเซ็ตบัญชีลูกค้าได้"
          : preview.code === "not_test_account"
            ? "บัญชีนี้ไม่ได้อยู่ใน allowlist บัญชีทดสอบ จึงไม่สามารถรีเซ็ตได้"
            : preview.code === "data_conflict"
              ? "สถานะออเดอร์ การชำระเงิน หรือสต๊อกไม่สอดคล้องกัน จึงยังรีเซ็ตไม่ได้"
            : "ไม่พบบัญชีลูกค้าที่ต้องการรีเซ็ต",
      preview
    };
  } catch {
    return { status: "error", message: "ไม่สามารถตรวจสอบข้อมูลก่อนรีเซ็ตได้ กรุณาลองอีกครั้ง" };
  }
}

export async function resetCustomerTestAccountAction(
  _previousState: AdminCustomerTestResetActionState,
  formData: FormData
): Promise<AdminCustomerTestResetActionState> {
  const session = await requireCustomerTestResetAdmin();
  const parsed = customerTestResetSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return { status: "error", message: "ข้อมูลยืนยันไม่ตรงกับ Preview กรุณาตรวจสอบใหม่" };
  }

  try {
    const result = await prisma.$transaction(
      (tx) =>
        resetCustomerTestAccount(tx, {
          actorId: session.userId,
          customerId: parsed.data.customerId,
          expectedUpdatedAt: new Date(parsed.data.expectedUpdatedAt),
          expectedFingerprint: parsed.data.expectedFingerprint,
          confirmationText: parsed.data.confirmationText
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    await cleanupCustomerTestResetFiles(result.files);
  } catch (error) {
    if (error instanceof CustomerTestResetError) {
      if (error.code === "STALE_PREVIEW") {
        return { status: "error", message: "ข้อมูลบัญชีเปลี่ยนหลัง Preview กรุณาตรวจสอบใหม่ก่อนยืนยัน" };
      }

      if (error.code === "CONFIRMATION_MISMATCH") {
        return { status: "error", message: "ข้อความยืนยันไม่ตรง จึงยังไม่มีการรีเซ็ตบัญชี" };
      }

      if (error.code === "STAFF_PROFILE_PRESENT") {
        return { status: "error", message: "บัญชีนี้มีประวัติสิทธิ์บุคลากร จึงไม่สามารถรีเซ็ตได้" };
      }

      if (error.code === "NOT_TEST_ACCOUNT") {
        return { status: "error", message: "บัญชีนี้ไม่ได้อยู่ใน allowlist บัญชีทดสอบ จึงไม่สามารถรีเซ็ตได้" };
      }

      if (error.code === "DATA_CONFLICT") {
        return {
          status: "error",
          message: "สถานะออเดอร์ การชำระเงิน หรือสต๊อกไม่สอดคล้องกัน ระบบจึงยกเลิกการรีเซ็ตทั้งชุด"
        };
      }

      return { status: "error", message: "ไม่พบบัญชีลูกค้าที่ต้องการรีเซ็ต" };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return { status: "error", message: "มีรายการอื่นกำลังเปลี่ยนข้อมูล กรุณา Preview ใหม่แล้วลองอีกครั้ง" };
    }

    return { status: "error", message: "ไม่สามารถรีเซ็ตบัญชีทดสอบได้ ข้อมูลเดิมยังไม่เปลี่ยนแปลง" };
  }

  revalidatePath("/");
  revalidatePath("/consult");
  revalidatePath("/store");
  revalidatePath("/community");
  revalidatePath("/profile");
  revalidatePath("/admin");
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${parsed.data.customerId}`);
  revalidatePath("/admin/audit");

  return {
    status: "success",
    message: "รีเซ็ตบัญชีทดสอบแล้ว เซสชันเดิมถูกยกเลิก และการเข้า LINE ครั้งถัดไปจะสร้างผู้ใช้ใหม่"
  };
}

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
        where: getActiveConsultAssessmentWhere(customer.id, now),
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
