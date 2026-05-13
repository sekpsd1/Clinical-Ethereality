"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { approveStaffRoleSchema, updateUserStatusSchema } from "@/features/admin/users/schema";

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function approveStaffRoleAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const parsed = approveStaffRoleSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    throw new Error("Invalid approval request.");
  }

  if (parsed.data.userId === session.userId) {
    throw new Error("Admins cannot change their own role from this workflow.");
  }

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

  revalidatePath("/admin/users");
}

export async function updateUserStatusAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const parsed = updateUserStatusSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    throw new Error("Invalid status update.");
  }

  if (parsed.data.userId === session.userId) {
    throw new Error("Admins cannot suspend or archive their own account from this workflow.");
  }

  await prisma.user.update({
    where: {
      id: parsed.data.userId
    },
    data: {
      status: parsed.data.status
    }
  });

  revalidatePath("/admin/users");
}
