"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { assertPermission } from "@/lib/permissions";
import {
  approveStaffRoleSchema,
  updateUserRoleSchema,
  updateUserStatusSchema
} from "@/features/admin/users/schema";
import {
  getStaffFileErrorMessage,
  StaffFileError
} from "@/features/staff-files/service";
import { staffFileEntityTypes, type StaffFileKind } from "@/features/staff-files/types";
import { uploadAdminStaffFile } from "@/features/admin/users/staff-files";

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
  assertPermission(session, "admin:access");
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
      if (parsed.data.role === "doctor" || parsed.data.role === "pharmacist") {
        const requiredFileCount = await tx.fileAttachment.count({
          where: {
            ownerId: parsed.data.userId,
            entityId: parsed.data.userId,
            entityType: {
              in: [staffFileEntityTypes.profilePhoto, staffFileEntityTypes.licenseProof]
            },
            status: "attached"
          }
        });

        if (requiredFileCount < 2) {
          throw new Error("STAFF_FILES_REQUIRED");
        }
      }

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

      await tx.notification.create({
        data: {
          userId: parsed.data.userId,
          type: "system",
          channel: "in_app",
          title: "คำขอสิทธิ์ได้รับการอนุมัติ",
          body:
            parsed.data.role === "doctor"
              ? "สิทธิ์แพทย์ได้รับการอนุมัติแล้ว กรุณาออกจากระบบและเข้าใหม่เพื่อเริ่มใช้งาน"
              : parsed.data.role === "pharmacist"
                ? "สิทธิ์เภสัชกรได้รับการอนุมัติแล้ว กรุณาออกจากระบบและเข้าใหม่เพื่อเริ่มใช้งาน"
                : "สิทธิ์ผู้ดูแลระบบได้รับการอนุมัติแล้ว กรุณาออกจากระบบและเข้าใหม่เพื่อเริ่มใช้งาน"
        }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "user.approve_staff_role",
        entityType: "user",
        entityId: parsed.data.userId,
        metadata: {
          role: parsed.data.role,
          status: "active"
        }
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "STAFF_FILES_REQUIRED") {
      return {
        status: "error",
        message: "ต้องมีรูปโปรไฟล์ทางการและเอกสารใบอนุญาตครบก่อนอนุมัติ"
      };
    }

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

export async function uploadStaffFileAction(
  _previousState: AdminUserActionState,
  formData: FormData
): Promise<AdminUserActionState> {
  const session = await requireAdminSession();
  assertPermission(session, "admin:access");
  const userId = formData.get("userId");
  const kind = formData.get("kind");
  const file = formData.get("file");

  if (
    typeof userId !== "string" ||
    !userId ||
    (kind !== "profilePhoto" && kind !== "licenseProof") ||
    !(file instanceof File) ||
    file.size === 0
  ) {
    return {
      status: "error",
      message: "ข้อมูลไฟล์ไม่ครบ กรุณาเลือกไฟล์แล้วลองใหม่"
    };
  }

  try {
    await uploadAdminStaffFile({
      actorId: session.userId,
      ownerId: userId,
      kind: kind as StaffFileKind,
      file
    });
  } catch (error) {
    if (error instanceof StaffFileError) {
      return {
        status: "error",
        message: getStaffFileErrorMessage(error)
      };
    }

    if (error instanceof Error && error.message === "STAFF_PROFILE_REQUIRED") {
      return {
        status: "error",
        message: "อัปโหลดไฟล์บุคลากรได้เฉพาะบัญชีแพทย์หรือเภสัชกร"
      };
    }

    return {
      status: "error",
      message: "ไม่สามารถอัปโหลดไฟล์บุคลากรได้ กรุณาลองใหม่"
    };
  }

  revalidatePath("/admin/users");

  return {
    status: "success",
    message: kind === "profilePhoto" ? "อัปโหลดรูปโปรไฟล์แล้ว" : "อัปโหลดเอกสารใบอนุญาตแล้ว"
  };
}

export async function updateUserStatusAction(
  _previousState: AdminUserActionState,
  formData: FormData
): Promise<AdminUserActionState> {
  const session = await requireAdminSession();
  assertPermission(session, "admin:access");
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
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: parsed.data.userId
        },
        data: {
          status: parsed.data.status
        }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "user.update_status",
        entityType: "user",
        entityId: parsed.data.userId,
        metadata: {
          status: parsed.data.status
        }
      });
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

export async function updateUserRoleAction(
  _previousState: AdminUserActionState,
  formData: FormData
): Promise<AdminUserActionState> {
  const session = await requireAdminSession();
  assertPermission(session, "admin:access");
  const parsed = updateUserRoleSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "คำขอเปลี่ยนสิทธิ์ไม่ถูกต้อง"
    };
  }

  if (parsed.data.userId === session.userId) {
    return {
      status: "error",
      message: "ไม่สามารถเปลี่ยนสิทธิ์ของบัญชีที่กำลังใช้งานอยู่"
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: {
          id: parsed.data.userId
        },
        select: {
          role: true,
          status: true
        }
      });

      if (!target) {
        throw new Error("USER_NOT_FOUND");
      }

      if (target.role !== "customer" && target.role !== "admin") {
        throw new Error("STAFF_ROLE_REQUIRES_APPROVAL");
      }

      if (target.role === parsed.data.role) {
        return {
          unchanged: true
        };
      }

      if (target.role === "admin" && parsed.data.role !== "admin" && target.status === "active") {
        const activeAdminCount = await tx.user.count({
          where: {
            role: "admin",
            status: "active"
          }
        });

        if (activeAdminCount <= 1) {
          throw new Error("LAST_ACTIVE_ADMIN");
        }
      }

      await tx.user.update({
        where: {
          id: parsed.data.userId
        },
        data: {
          role: parsed.data.role
        }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "user.update_role",
        entityType: "user",
        entityId: parsed.data.userId,
        metadata: {
          previousRole: target.role,
          role: parsed.data.role,
          status: target.status
        }
      });

      return {
        unchanged: false
      };
    });

    revalidatePath("/admin/users");

    return {
      status: "success",
      message: result.unchanged ? "บัญชีนี้ใช้สิทธิ์ดังกล่าวอยู่แล้ว" : "เปลี่ยนสิทธิ์เรียบร้อยแล้ว กรุณาให้ผู้ใช้ออกจากระบบแล้วเข้าใหม่"
    };
  } catch (error) {
    if (error instanceof Error && error.message === "LAST_ACTIVE_ADMIN") {
      return {
        status: "error",
        message: "ต้องมีผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 บัญชี"
      };
    }

    if (error instanceof Error && error.message === "STAFF_ROLE_REQUIRES_APPROVAL") {
      return {
        status: "error",
        message: "แพทย์และเภสัชกรต้องเปลี่ยนสิทธิ์ผ่านขั้นตอนตรวจใบอนุญาต"
      };
    }

    return {
      status: "error",
      message: "ไม่สามารถเปลี่ยนสิทธิ์ได้ กรุณาตรวจสอบฐานข้อมูลแล้วลองใหม่"
    };
  }
}
