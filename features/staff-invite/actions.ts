"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { staffInviteRequestSchema } from "@/features/staff-invite/schema";

export type StaffInviteActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function optionalText(value?: string) {
  return value && value.length > 0 ? value : undefined;
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
      message: "ข้อมูลคำขอไม่ถูกต้อง"
    };
  }

  if (session.role !== "customer") {
    return {
      status: "error",
      message: "บัญชีนี้มีสิทธิ์บุคลากรอยู่แล้ว หากต้องการเปลี่ยนสิทธิ์ให้ผู้ดูแลระบบตรวจในหน้าอนุมัติ"
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: {
          id: session.userId
        },
        include: {
          doctorProfile: true,
          pharmacistProfile: true
        }
      });

      if (!user || user.status === "suspended" || user.status === "archived") {
        throw new Error("USER_NOT_ELIGIBLE");
      }

      if (parsed.data.role === "doctor") {
        await tx.doctor.upsert({
          where: {
            userId: session.userId
          },
          create: {
            userId: session.userId,
            licenseNumber: optionalText(parsed.data.licenseNumber),
            specialty: optionalText(parsed.data.specialty),
            status: "pending_review"
          },
          update: {
            licenseNumber: optionalText(parsed.data.licenseNumber),
            specialty: optionalText(parsed.data.specialty),
            status: "pending_review"
          }
        });
      }

      if (parsed.data.role === "pharmacist") {
        await tx.pharmacist.upsert({
          where: {
            userId: session.userId
          },
          create: {
            userId: session.userId,
            licenseNumber: optionalText(parsed.data.licenseNumber),
            pharmacyName: optionalText(parsed.data.pharmacyName),
            status: "pending_review"
          },
          update: {
            licenseNumber: optionalText(parsed.data.licenseNumber),
            pharmacyName: optionalText(parsed.data.pharmacyName),
            status: "pending_review"
          }
        });
      }

      await tx.user.update({
        where: {
          id: session.userId
        },
        data: {
          status: "pending_review"
        }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "staff_invite.request",
        entityType: "user",
        entityId: session.userId,
        metadata: {
          requestedRole: parsed.data.role
        }
      });
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
