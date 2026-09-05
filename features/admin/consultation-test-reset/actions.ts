"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireAdminSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";
import {
  consultationTestResetSchema,
  previewConsultationTestResetSchema
} from "@/features/admin/consultation-test-reset/schema";
import {
  ConsultationTestResetError,
  cancelSelectedTestConsultation,
  previewSelectedTestConsultationReset,
  type ConsultationTestResetPreview
} from "@/features/admin/consultation-test-reset/service";

export type AdminConsultationTestResetActionState = {
  status: "idle" | "success" | "error";
  message: string;
  preview?: ConsultationTestResetPreview;
};

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

async function requireTestResetAdmin() {
  const session = await requireAdminSession();
  assertPermission(session, "consultation:test-reset");
  return session;
}

export async function previewConsultationTestResetAction(
  _previousState: AdminConsultationTestResetActionState,
  formData: FormData
): Promise<AdminConsultationTestResetActionState> {
  await requireTestResetAdmin();
  const parsed = previewConsultationTestResetSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return { status: "error", message: "รหัสนัดหมายที่เลือกไม่ถูกต้อง" };
  }

  const preview = await prisma.$transaction(
    (tx) => previewSelectedTestConsultationReset(tx, parsed.data.consultationId),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  if (preview.code === "eligible") {
    return {
      status: "success",
      message: "ตรวจสอบแล้ว: นัดหมายทดสอบนี้พร้อมยกเลิกแบบเก็บประวัติ",
      preview
    };
  }
  if (preview.code === "already_reset") {
    return {
      status: "success",
      message: "นัดหมายทดสอบนี้ถูกรีเซ็ตไว้แล้ว ไม่มีการเปลี่ยนแปลงเพิ่มเติม",
      preview
    };
  }
  return {
    status: "error",
    message: "นัดหมายที่เลือกไม่ผ่านเงื่อนไขการรีเซ็ตข้อมูลทดสอบ",
    preview
  };
}

export async function cancelConsultationForTestResetAction(
  _previousState: AdminConsultationTestResetActionState,
  formData: FormData
): Promise<AdminConsultationTestResetActionState> {
  const session = await requireTestResetAdmin();
  const parsed = consultationTestResetSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "ข้อมูลยืนยันไม่ตรงกับนัดหมายที่ตรวจสอบ กรุณา Preview ใหม่"
    };
  }

  try {
    const result = await prisma.$transaction(
      (tx) =>
        cancelSelectedTestConsultation(tx, {
          actorId: session.userId,
          consultationId: parsed.data.consultationId,
          expectedStatus: parsed.data.expectedStatus,
          expectedUpdatedAt: new Date(parsed.data.expectedUpdatedAt),
          reason: parsed.data.reason
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    revalidatePath("/admin/schedules");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/audit");
    revalidatePath("/doctor/consultations");

    return {
      status: "success",
      message:
        result.outcome === "already_reset"
          ? "นัดหมายทดสอบนี้ถูกรีเซ็ตไว้แล้ว ไม่มีการเปลี่ยนแปลงเพิ่มเติม"
          : "ยกเลิกนัดหมายทดสอบและเก็บประวัติการชำระเงินเรียบร้อยแล้ว"
    };
  } catch (error) {
    if (error instanceof ConsultationTestResetError) {
      if (error.code === "STALE_PREVIEW" || error.code === "CONFLICT") {
        return {
          status: "error",
          message: "ข้อมูลนัดหมายเปลี่ยนแปลงแล้ว กรุณา Preview ใหม่ก่อนยืนยัน"
        };
      }
      if (error.code === "UNSAFE_SLOT_LOCK" || error.code === "INTEGRITY_ERROR") {
        return {
          status: "error",
          message: "พบความไม่สอดคล้องของข้อมูล จึงไม่เปลี่ยนแปลงนัดหมาย"
        };
      }
      return {
        status: "error",
        message: "นัดหมายที่เลือกไม่ผ่านเงื่อนไขการรีเซ็ตข้อมูลทดสอบ"
      };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return {
        status: "error",
        message: "มีรายการอื่นกำลังเปลี่ยนข้อมูลนัดหมาย กรุณา Preview ใหม่แล้วลองอีกครั้ง"
      };
    }
    return { status: "error", message: "ไม่สามารถรีเซ็ตนัดหมายทดสอบได้" };
  }
}
