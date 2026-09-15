"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { updateProfileContactSchema } from "@/features/profile/schema";

export type UpdateProfileContactActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function getProfileFormData(formData: FormData) {
  return {
    fullName: formData.get("fullName"),
    dateOfBirth: formData.get("dateOfBirth"),
    email: formData.get("email")
  };
}

export async function updateProfileContactAction(
  _previousState: UpdateProfileContactActionState,
  formData: FormData
): Promise<UpdateProfileContactActionState> {
  const session = await requireCurrentSession();
  assertPermission(session, "profile:update:self");

  const parsed = updateProfileContactSchema.safeParse(getProfileFormData(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "ข้อมูลติดต่อไม่ถูกต้อง"
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: {
          id: session.userId
        },
        select: {
          role: true,
          status: true,
          fullName: true,
          dateOfBirth: true,
          email: true
        }
      });

      if (!currentUser || currentUser.role !== "customer" || currentUser.status !== "active") {
        throw new Error("ACTIVE_CUSTOMER_REQUIRED");
      }

      const fullName = parsed.data.fullName;
      const dateOfBirth = new Date(`${parsed.data.dateOfBirth}T00:00:00.000Z`);
      const email = parsed.data.email ?? null;
      const currentDateOfBirth = currentUser.dateOfBirth?.toISOString().slice(0, 10) ?? null;
      const identityChanged = currentUser.fullName !== fullName || currentDateOfBirth !== parsed.data.dateOfBirth;
      const changedFields = [
        ...(currentUser.fullName !== fullName ? ["fullName"] : []),
        ...(currentDateOfBirth !== parsed.data.dateOfBirth ? ["dateOfBirth"] : []),
        ...(currentUser.email !== email ? ["email"] : []),
      ];

      if (changedFields.length === 0) return;

      const updated = await tx.user.updateMany({
        where: { id: session.userId, role: "customer", status: "active" },
        data: { fullName, dateOfBirth, email }
      });
      if (updated.count !== 1) throw new Error("ACTIVE_CUSTOMER_REQUIRED");

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: identityChanged ? "profile.identity.update" : "profile.contact.update",
        entityType: "user",
        entityId: session.userId,
        metadata: { changedFields }
      });
    });
  } catch {
    return {
      status: "error",
      message: "ยังบันทึกข้อมูลไม่ได้ กรุณาลองใหม่อีกครั้ง"
    };
  }

  revalidatePath("/profile");
  revalidatePath("/profile/settings");

  return {
    status: "success",
    message: "บันทึกข้อมูลบัญชีแล้ว"
  };
}
