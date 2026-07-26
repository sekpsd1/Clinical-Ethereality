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

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function updateProfileContactAction(
  _previousState: UpdateProfileContactActionState,
  formData: FormData
): Promise<UpdateProfileContactActionState> {
  const session = await requireCurrentSession();
  assertPermission(session, "profile:update:self");

  const parsed = updateProfileContactSchema.safeParse(formDataToObject(formData));

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
          email: true,
          phone: true
        }
      });

      if (!currentUser) {
        throw new Error("USER_NOT_FOUND");
      }

      const email = parsed.data.email ?? null;
      const phone = parsed.data.phone ?? null;
      const changedFields = [
        ...(currentUser.email !== email ? ["email"] : []),
        ...(currentUser.phone !== phone ? ["phone"] : [])
      ];

      await tx.user.update({
        where: {
          id: session.userId
        },
        data: {
          email,
          phone
        }
      });

      if (changedFields.length > 0) {
        await writeAuditLog(tx, {
          actorId: session.userId,
          action: "profile.contact.update",
          entityType: "user",
          entityId: session.userId,
          metadata: {
            changedFields
          }
        });
      }
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
    message: "บันทึกข้อมูลติดต่อแล้ว"
  };
}
