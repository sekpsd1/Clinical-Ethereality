"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { staffInviteRequestSchema } from "@/features/staff-invite/schema";
import { submitStaffInviteRequest } from "@/features/staff-invite/service";

export type StaffInviteActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function formDataToObject(formData: FormData) {
  return {
    ...Object.fromEntries(
      Array.from(formData.entries()).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    ),
    specialties: formData
      .getAll("specialties")
      .filter((value): value is string => typeof value === "string")
  };
}

export async function requestStaffInviteAction(
  _previousState: StaffInviteActionState,
  formData: FormData
): Promise<StaffInviteActionState> {
  const session = await getCurrentSession();

  if (!session) {
    return {
      status: "error",
      message: "กรุณาเข้าสู่ระบบผ่าน LINE ก่อนส่งคำขอ"
    };
  }

  const parsed = staffInviteRequestSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "ข้อมูลคำขอไม่ถูกต้อง"
    };
  }

  if (session.role !== "customer") {
    return {
      status: "error",
      message: "บัญชีนี้มีสิทธิ์บุคลากรอยู่แล้ว หากต้องการเปลี่ยนสิทธิ์ให้ผู้ดูแลระบบตรวจในหน้าอนุมัติ"
    };
  }

  try {
    await submitStaffInviteRequest({
      userId: session.userId,
      data: parsed.data
    });
  } catch {
    return {
      status: "error",
      message: "ยังส่งคำขอไม่ได้ กรุณาตรวจสอบสถานะบัญชีหรือฐานข้อมูลแล้วลองใหม่"
    };
  }

  revalidatePath(`/staff-invite/${parsed.data.role}`);
  revalidatePath("/admin/users");

  return {
    status: "success",
    message: "ส่งคำขอแล้ว ผู้ดูแลระบบจะตรวจสอบก่อนเปิดสิทธิ์ให้ใช้งาน"
  };
}
