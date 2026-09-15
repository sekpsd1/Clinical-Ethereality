"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { updateProfileContactSchema } from "@/features/profile/schema";
import { normalizeThaiMobileNumber } from "@/lib/identity/thai-phone";

export type UpdateProfileContactActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function getProfileFormData(formData: FormData) {
  return {
    fullName: formData.get("fullName") ?? undefined,
    dateOfBirth: formData.get("dateOfBirth") ?? undefined,
    email: formData.get("email"),
    phone: formData.get("phone") ?? undefined
  };
}

export async function updateProfileContactAction(
  _previousState: UpdateProfileContactActionState,
  formData: FormData
): Promise<UpdateProfileContactActionState> {
  const session = await requireCurrentSession();
  assertPermission(session, "profile:update:self");

  const parsed = updateProfileContactSchema.safeParse(getProfileFormData(formData));
  const phoneProvided = formData.has("phone");

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
          email: true,
          phone: true,
          normalizedPhone: true
        }
      });

      if (!currentUser || currentUser.role !== "customer" || currentUser.status !== "active") {
        throw new Error("ACTIVE_CUSTOMER_REQUIRED");
      }

      const fullName = parsed.data.fullName ?? currentUser.fullName;
      const dateOfBirth = parsed.data.dateOfBirth
        ? new Date(`${parsed.data.dateOfBirth}T00:00:00.000Z`)
        : currentUser.dateOfBirth;
      const email = parsed.data.email ?? null;
      const phone = phoneProvided ? parsed.data.phone ?? null : currentUser.phone;
      const normalizedPhone = phoneProvided
        ? phone
          ? normalizeThaiMobileNumber(phone).e164
          : null
        : currentUser.normalizedPhone;
      const currentDateOfBirth = currentUser.dateOfBirth?.toISOString().slice(0, 10) ?? null;
      const fullNameChanged = parsed.data.fullName !== undefined && currentUser.fullName !== fullName;
      const dateOfBirthChanged = parsed.data.dateOfBirth !== undefined && currentDateOfBirth !== parsed.data.dateOfBirth;
      const phoneChanged = phoneProvided && currentUser.normalizedPhone !== normalizedPhone;
      const identityChanged = fullNameChanged || dateOfBirthChanged;
      const changedFields = [
        ...(fullNameChanged ? ["fullName"] : []),
        ...(dateOfBirthChanged ? ["dateOfBirth"] : []),
        ...(currentUser.email !== email ? ["email"] : []),
        ...(phoneProvided && currentUser.phone !== phone ? ["phone"] : []),
        ...(phoneChanged ? ["phoneVerificationInvalidated"] : [])
      ];

      if (changedFields.length === 0) return;

      const updated = await tx.user.updateMany({
        where: { id: session.userId, role: "customer", status: "active" },
        data: {
          ...(parsed.data.fullName !== undefined ? { fullName } : {}),
          ...(parsed.data.dateOfBirth !== undefined ? { dateOfBirth } : {}),
          email,
          ...(phoneProvided
            ? {
                phone,
                normalizedPhone,
                ...(phoneChanged ? { phoneVerifiedAt: null } : {})
              }
            : {})
        }
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
