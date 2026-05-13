import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { PublicSession } from "@/lib/auth/types";
import type { CustomerRewardLedgerItem, CustomerRewardsData } from "@/features/rewards/types";

type RewardRecord = Awaited<ReturnType<typeof getRewardLedger>>[number];

const sourceLabels: Record<RewardRecord["sourceType"], string> = {
  consultation: "Consultation",
  order: "Order",
  community: "Community",
  admin_adjustment: "Wellness credit"
};

function getRewardLedger(userId: string) {
  return prisma.rewardPoint.findMany({
    where: {
      userId
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 50
  });
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function mapLedgerItem(reward: RewardRecord): CustomerRewardLedgerItem {
  const sign = reward.direction === "spend" || reward.direction === "expire" ? "-" : "+";

  return {
    id: reward.id,
    sourceType: reward.sourceType,
    sourceLabel: sourceLabels[reward.sourceType],
    direction: reward.direction,
    points: reward.points,
    signedPoints: `${sign}${reward.points}`,
    expiresAt: reward.expiresAt ? formatDate(reward.expiresAt) : null,
    createdAt: formatDate(reward.createdAt)
  };
}

export async function getCustomerRewards(session: PublicSession): Promise<CustomerRewardsData> {
  noStore();

  try {
    const [user, ledger] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: session.userId
        },
        select: {
          rewardBalance: true
        }
      }),
      getRewardLedger(session.userId)
    ]);

    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 30);

    return {
      balance: user?.rewardBalance ?? 0,
      expiringSoon: ledger
        .filter((reward) => reward.direction === "earn" && reward.expiresAt && reward.expiresAt > now && reward.expiresAt <= soon)
        .reduce((total, reward) => total + reward.points, 0),
      ledger: ledger.map(mapLedgerItem)
    };
  } catch {
    return {
      balance: 0,
      expiringSoon: 0,
      ledger: [],
      unavailable: true
    };
  }
}
