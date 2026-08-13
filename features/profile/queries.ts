import { unstable_noStore as noStore } from "next/cache";
import type { PublicSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import type { CustomerProfileData } from "@/features/profile/types";

const memberStatusLabels = {
  active: "สมาชิกที่ยืนยันแล้ว",
  pending_review: "บัญชีรอตรวจสอบ",
  suspended: "บัญชีถูกระงับ",
  archived: "บัญชีถูกเก็บถาวร"
} as const;

export async function getCustomerProfileData(session: PublicSession): Promise<CustomerProfileData> {
  noStore();

  try {
    const [user, adviceCount, postCount] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: session.userId
        },
        select: {
          displayName: true,
          avatarUrl: true,
          email: true,
          phone: true,
          phoneVerifiedAt: true,
          status: true
        }
      }),
      prisma.consultation.count({
        where: {
          patientId: session.userId,
          status: "completed"
        }
      }),
      prisma.article.count({
        where: {
          authorId: session.userId,
          status: "published"
        }
      })
    ]);

    return {
      displayName: user?.displayName ?? session.displayName ?? "ผู้ใช้ LINE",
      avatarUrl: user?.avatarUrl ?? session.pictureUrl ?? null,
      email: user?.email ?? null,
      phone: user?.phone ?? null,
      phoneVerifiedAt: user?.phoneVerifiedAt?.toISOString() ?? null,
      memberStatus: user ? memberStatusLabels[user.status] : "สมาชิก LINE",
      adviceCount,
      postCount
    };
  } catch {
    return {
      displayName: session.displayName ?? "ผู้ใช้ LINE",
      avatarUrl: session.pictureUrl ?? null,
      email: null,
      phone: null,
      phoneVerifiedAt: null,
      memberStatus: "สมาชิก LINE",
      adviceCount: 0,
      postCount: 0,
      unavailable: true
    };
  }
}
