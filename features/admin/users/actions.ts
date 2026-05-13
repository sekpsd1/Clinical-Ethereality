"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { approveStaffRoleSchema, updateUserStatusSchema } from "@/features/admin/users/schema";

export type AdminUserActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function approveStaffRoleAction(
  _previousState: AdminUserActionState,
  formData: FormData
): Promise<AdminUserActionState> {
  const session = await requireAdminSession();
  const parsed = approveStaffRoleSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "คำขออนุมัติไม่ถูกต้อง"
    };
  }

  if (parsed.data.userId === session.userId) {
    return {
      status: "error",
      message: "ผู้ดูแลไม่สามารถเปลี่ยนสิทธิ์ของตนเองจากขั้นตอนนี้ได้"
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: parsed.data.userId
        },
        data: {
          role: parsed.data.role,
          status: "active"
        }
      });

      if (parsed.data.role === "doctor") {
        await tx.doctor.upsert({
          where: {
            userId: parsed.data.userId
          },
          create: {
            userId: parsed.data.userId,
            status: "approved",
            approvedAt: new Date()
          },
          update: {
            status: "approved",
            approvedAt: new Date()
          }
        });
      }

      if (parsed.data.role === "pharmacist") {
        await tx.pharmacist.upsert({
          where: {
            userId: parsed.data.userId
          },
          create: {
            userId: parsed.data.userId,
            status: "approved",
            approvedAt: new Date()
          },
          update: {
            status: "approved",
            approvedAt: new Date()
          }
        });
      }
    });
  } catch {
    return {
      status: "error",
      message: "ไม่สามารถอนุมัติสิทธิ์ได้ กรุณาตรวจสอบฐานข้อมูลแล้วลองใหม่"
    };
  }

  revalidatePath("/admin/users");

  return {
    status: "success",
    message: "อนุมัติสิทธิ์เรียบร้อยแล้ว"
  };
}

export async function updateUserStatusAction(
  _previousState: AdminUserActionState,
  formData: FormData
): Promise<AdminUserActionState> {
  const session = await requireAdminSession();
  const parsed = updateUserStatusSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "คำขออัปเดตสถานะไม่ถูกต้อง"
    };
  }

  if (parsed.data.userId === session.userId) {
    return {
      status: "error",
      message: "ผู้ดูแลไม่สามารถระงับหรือเก็บถาวรบัญชีของตนเองจากขั้นตอนนี้ได้"
    };
  }

  try {
    await prisma.user.update({
      where: {
        id: parsed.data.userId
      },
      data: {
        status: parsed.data.status
      }
    });
  } catch {
    return {
      status: "error",
      message: "ไม่สามารถอัปเดตสถานะได้ กรุณาตรวจสอบฐานข้อมูลแล้วลองใหม่"
    };
  }

  revalidatePath("/admin/users");

  return {
    status: "success",
    message: parsed.data.status === "suspended" ? "ระงับบัญชีเรียบร้อยแล้ว" : "อัปเดตสถานะเรียบร้อยแล้ว"
  };
}
