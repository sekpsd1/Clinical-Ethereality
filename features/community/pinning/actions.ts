"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { updateArticlePinSchema } from "@/features/community/pinning/schema";
import { ArticlePinError, updateArticlePinState } from "@/features/community/pinning/service";

export type ArticlePinActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function getPinErrorMessage(error: unknown): string {
  if (!(error instanceof ArticlePinError)) {
    return "ยังอัปเดตหมุดไม่ได้ กรุณาลองอีกครั้ง";
  }

  if (error.code === "unauthorized") return "เฉพาะบัญชี Admin ที่เปิดใช้งานเท่านั้นที่จัดการหมุดได้";
  if (error.code === "not_found") return "ไม่พบโพสต์นี้";
  if (error.code === "not_published") return "ปักหมุดได้เฉพาะโพสต์ที่เผยแพร่อยู่";
  if (error.code === "limit_reached") return "ปักหมุดครบ 3 โพสต์แล้ว กรุณาถอนหมุดเดิมก่อน";
  return "สถานะโพสต์เปลี่ยนระหว่างบันทึก กรุณาลองอีกครั้ง";
}

export async function updateArticlePinAction(
  _previousState: ArticlePinActionState,
  formData: FormData
): Promise<ArticlePinActionState> {
  const session = await getCurrentSession();

  if (!session || session.role !== "admin") {
    return {
      status: "error",
      message: "เฉพาะบัญชี Admin ที่เปิดใช้งานเท่านั้นที่จัดการหมุดได้"
    };
  }

  const parsed = updateArticlePinSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      status: "error",
      message: "คำขอจัดการหมุดไม่ถูกต้อง"
    };
  }

  try {
    const result = await updateArticlePinState({
      actorId: session.userId,
      articleId: parsed.data.articleId,
      action: parsed.data.action
    });

    revalidatePath("/community");
    revalidatePath("/community/search");
    revalidatePath("/profile/saved-articles");
    revalidatePath("/admin/moderation");
    revalidatePath("/notifications");

    if (!result.changed) {
      return {
        status: "success",
        message: result.pinned ? "โพสต์นี้ปักหมุดอยู่แล้ว" : "โพสต์นี้ไม่ได้ปักหมุดอยู่"
      };
    }

    return {
      status: "success",
      message: result.pinned ? "ปักหมุดโพสต์แล้ว" : "ถอนหมุดโพสต์แล้ว"
    };
  } catch (error) {
    return {
      status: "error",
      message: getPinErrorMessage(error)
    };
  }
}
