"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireActiveAdminSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { manageDoctorProfileSchema } from "@/features/admin/users/schema";
import {
  DoctorProfileManagementError,
  manageAdminDoctorProfile
} from "@/features/admin/users/doctor-profile-service";

export type ManageDoctorProfileActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

function formDataToObject(formData: FormData) {
  return {
    userId: formData.get("userId"),
    intent: formData.get("intent"),
    fullName: formData.get("fullName"),
    specialty: formData.get("specialty"),
    licenseNumber: formData.get("licenseNumber"),
    bio: formData.get("bio")
  };
}

const errorMessages: Record<DoctorProfileManagementError["code"], string> = {
  ACTIVE_ADMIN_REQUIRED: "เฉพาะผู้ดูแลระบบที่เปิดใช้งานอยู่เท่านั้นที่จัดการข้อมูลแพทย์ได้",
  TARGET_NOT_FOUND: "ไม่พบบัญชี LINE ที่เลือก",
  TARGET_NOT_ELIGIBLE: "บัญชีที่เลือกต้องเปิดใช้งานอยู่ และต้องเป็นบัญชีลูกค้าหรือแพทย์เท่านั้น",
  SELF_MANAGEMENT_FORBIDDEN: "ไม่สามารถใช้บัญชีผู้ดูแลที่กำลังใช้งานเป็นบัญชีแพทย์จากขั้นตอนนี้ได้",
  LICENSE_ALREADY_USED: "เลขที่ใบประกอบวิชาชีพนี้ถูกใช้กับแพทย์รายอื่นแล้ว",
  FILES_REQUIRED: "ต้องมีรูปโปรไฟล์ทางการและเอกสารใบอนุญาตครบก่อนอนุมัติแพทย์"
};

export async function manageDoctorProfileAction(
  _previousState: ManageDoctorProfileActionState,
  formData: FormData
): Promise<ManageDoctorProfileActionState> {
  const session = await requireActiveAdminSession();
  const parsed = manageDoctorProfileSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "ข้อมูลแพทย์ไม่ถูกต้อง",
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }

  try {
    const result = await prisma.$transaction(
      (tx) => manageAdminDoctorProfile(tx, { actorId: session.userId, data: parsed.data }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    revalidatePath("/admin/users");
    revalidatePath("/admin/schedules");
    revalidatePath("/consult");

    return {
      status: "success",
      message: result.unchanged
        ? result.approved
          ? "ข้อมูลและสิทธิ์แพทย์เป็นปัจจุบันอยู่แล้ว"
          : "ข้อมูลแพทย์ไม่มีการเปลี่ยนแปลง"
        : result.approved
          ? "บันทึกข้อมูลและอนุมัติแพทย์แล้ว กรุณาให้แพทย์ออกจากระบบและเข้าใหม่"
          : "บันทึกข้อมูลแพทย์แล้ว"
    };
  } catch (error) {
    if (error instanceof DoctorProfileManagementError) {
      return { status: "error", message: errorMessages[error.code] };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { status: "error", message: errorMessages.LICENSE_ALREADY_USED };
      }

      if (error.code === "P2034") {
        return {
          status: "error",
          message: "มีผู้ดูแลอีกคนกำลังเปลี่ยนข้อมูลนี้ กรุณารีเฟรชและตรวจสอบก่อนลองอีกครั้ง"
        };
      }
    }

    return {
      status: "error",
      message: "ไม่สามารถบันทึกข้อมูลแพทย์ได้ กรุณาลองอีกครั้ง"
    };
  }
}
