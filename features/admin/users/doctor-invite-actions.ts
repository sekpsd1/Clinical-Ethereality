"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireActiveAdminSession } from "@/lib/auth/guards";
import { getPublicAppOrigin } from "@/lib/auth/line-oauth";
import {
  DoctorInviteError,
  issueDoctorInvitation,
  revokeDoctorInvitation
} from "@/features/staff-invite/doctor-invite";

export type CreateDoctorInviteActionState = {
  status: "idle" | "success" | "error";
  message: string;
  inviteUrl?: string;
  expiresAt?: string;
};

export type RevokeDoctorInviteActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const createSchema = z.object({
  idempotencyKey: z.string().uuid()
});

const revokeSchema = z.object({
  invitationId: z.string().trim().min(1).max(191)
});

export async function createDoctorInviteAction(
  _previousState: CreateDoctorInviteActionState,
  formData: FormData
): Promise<CreateDoctorInviteActionState> {
  const session = await requireActiveAdminSession();
  const parsed = createSchema.safeParse({ idempotencyKey: formData.get("idempotencyKey") });
  if (!parsed.success) {
    return { status: "error", message: "ไม่สามารถเริ่มสร้างลิงก์ได้ กรุณาลองใหม่" };
  }

  const requestHeaders = await headers();
  const fallbackOrigin = requestHeaders.get("origin") ?? "http://localhost:3000";

  try {
    const invitation = await prisma.$transaction(
      (tx) =>
        issueDoctorInvitation(tx, {
          actorId: session.userId,
          idempotencyKey: parsed.data.idempotencyKey,
          origin: getPublicAppOrigin(fallbackOrigin)
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    revalidatePath("/admin/users");
    return {
      status: "success",
      message: "สร้างลิงก์เชิญแล้ว ลิงก์นี้จะแสดงครั้งเดียวและหมดอายุภายใน 24 ชั่วโมง",
      inviteUrl: invitation.inviteUrl,
      expiresAt: invitation.expiresAt.toISOString()
    };
  } catch (error) {
    if (error instanceof DoctorInviteError && error.code === "ACTIVE_ADMIN_REQUIRED") {
      return { status: "error", message: "เฉพาะผู้ดูแลระบบที่เปิดใช้งานอยู่เท่านั้นที่สร้างลิงก์ได้" };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return { status: "error", message: "มีรายการอื่นกำลังสร้างลิงก์ กรุณาลองใหม่" };
    }
    return { status: "error", message: "ไม่สามารถสร้างลิงก์เชิญได้ กรุณาลองใหม่" };
  }
}

export async function revokeDoctorInviteAction(
  _previousState: RevokeDoctorInviteActionState,
  formData: FormData
): Promise<RevokeDoctorInviteActionState> {
  const session = await requireActiveAdminSession();
  const parsed = revokeSchema.safeParse({ invitationId: formData.get("invitationId") });
  if (!parsed.success) {
    return { status: "error", message: "ลิงก์ที่เลือกไม่ถูกต้อง" };
  }

  try {
    const result = await prisma.$transaction(
      (tx) =>
        revokeDoctorInvitation(tx, {
          actorId: session.userId,
          invitationId: parsed.data.invitationId
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    revalidatePath("/admin/users");
    return {
      status: "success",
      message: result.unchanged ? "ลิงก์นี้ถูกเพิกถอนไว้แล้ว" : "เพิกถอนลิงก์เชิญแล้ว"
    };
  } catch (error) {
    if (error instanceof DoctorInviteError) {
      return {
        status: "error",
        message:
          error.code === "ACTIVE_ADMIN_REQUIRED"
            ? "เฉพาะผู้ดูแลระบบที่เปิดใช้งานอยู่เท่านั้นที่เพิกถอนลิงก์ได้"
            : "ไม่พบลิงก์ที่เพิกถอนได้ หรือบัญชีแพทย์ได้รับอนุมัติแล้ว"
      };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return { status: "error", message: "สถานะลิงก์มีการเปลี่ยนแปลง กรุณารีเฟรชแล้วลองใหม่" };
    }
    return { status: "error", message: "ไม่สามารถเพิกถอนลิงก์ได้ กรุณาลองใหม่" };
  }
}
