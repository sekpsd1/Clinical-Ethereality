"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { staffInviteRequestSchema } from "@/features/staff-invite/schema";
import { formatDoctorSpecialties } from "@/features/staff-invite/doctor-specialties";
import {
  getStaffFileErrorMessage,
  StaffFileError,
  storeStaffFiles
} from "@/features/staff-files/service";

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
    if (parsed.data.role !== "admin") {
      const profilePhoto = formData.get("profilePhoto");
      const licenseProof = formData.get("licenseProof");

      if (!(profilePhoto instanceof File) || profilePhoto.size === 0 || !(licenseProof instanceof File) || licenseProof.size === 0) {
        return {
          status: "error",
          message: "กรุณาแนบรูปโปรไฟล์ทางการและเอกสารใบอนุญาตให้ครบ"
        };
      }

      const eligibleUser = await prisma.user.findUnique({
        where: {
          id: session.userId
        },
        select: {
          status: true
        }
      });

      if (!eligibleUser || eligibleUser.status === "suspended" || eligibleUser.status === "archived") {
        throw new Error("USER_NOT_ELIGIBLE");
      }

      await storeStaffFiles({
        actorId: session.userId,
        ownerId: session.userId,
        uploads: [
          {
            kind: "profilePhoto",
            file: profilePhoto
          },
          {
            kind: "licenseProof",
            file: licenseProof
          }
        ]
      });
    }

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
        const specialty = formatDoctorSpecialties(
          parsed.data.specialties ?? [],
          parsed.data.otherSpecialty
        );

        await tx.doctor.upsert({
          where: {
            userId: session.userId
          },
          create: {
            userId: session.userId,
            licenseNumber: optionalText(parsed.data.licenseNumber),
            specialty,
            status: "pending_review"
          },
          update: {
            licenseNumber: optionalText(parsed.data.licenseNumber),
            specialty,
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
          displayName:
            parsed.data.role !== "admin"
              ? `${parsed.data.firstName} ${parsed.data.lastName}`
              : undefined,
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
  } catch (error) {
    if (error instanceof StaffFileError) {
      return {
        status: "error",
        message: getStaffFileErrorMessage(error)
      };
    }

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
