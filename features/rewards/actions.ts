"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { spendRewardPoints, rewardRules } from "@/features/rewards/rules";

export async function redeemWellnessCreditAction(): Promise<void> {
  const session = await requireCurrentSession();

  await prisma.$transaction(async (tx) => {
    await spendRewardPoints(tx, {
      userId: session.userId,
      sourceType: "admin_adjustment",
      sourceId: `wellness-credit:${Date.now()}`,
      points: rewardRules.wellnessCredit.points
    });

    await tx.notification.create({
      data: {
        userId: session.userId,
        type: "reward",
        channel: "in_app",
        title: "ใช้แต้มสำเร็จ",
        body: "คุณใช้ 50 แต้มเพื่อรับ wellness credit แล้ว",
        metadataJson: {
          href: "/profile/rewards"
        }
      }
    });
  });

  revalidatePath("/profile");
  revalidatePath("/profile/rewards");
  revalidatePath("/notifications");
}
