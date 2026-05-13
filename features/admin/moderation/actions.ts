"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { updateModerationItemSchema } from "@/features/admin/moderation/schema";

export type AdminModerationActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function updateModerationItemAction(
  _previousState: AdminModerationActionState,
  formData: FormData
): Promise<AdminModerationActionState> {
  await requireAdminSession();
  const parsed = updateModerationItemSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Moderation request is invalid."
    };
  }

  const { action, itemId, itemType } = parsed.data;

  try {
    if (itemType === "article") {
      await prisma.article.update({
        where: {
          id: itemId
        },
        data: {
          status: action === "restore" ? "published" : action === "hide" ? "hidden" : "archived",
          publishedAt: action === "restore" ? new Date() : undefined
        }
      });
    } else {
      await prisma.comment.update({
        where: {
          id: itemId
        },
        data: {
          status: action === "restore" ? "visible" : action === "hide" ? "hidden" : "archived"
        }
      });
    }
  } catch {
    return {
      status: "error",
      message: "Could not update moderation item. Check the item and try again."
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/moderation");

  return {
    status: "success",
    message: action === "restore" ? "Content restored." : action === "hide" ? "Content hidden." : "Content archived."
  };
}
