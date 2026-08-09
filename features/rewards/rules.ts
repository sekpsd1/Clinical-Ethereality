import { Prisma, type RewardPointSource } from "@prisma/client";

export const rewardRules = {
  orderEarnRate: {
    label: "รับ 1 แต้มต่อยอดคำสั่งซื้อที่ชำระแล้วทุก 10 บาท",
    pointsPerThb: 0.1
  },
  communityComment: {
    label: "รับ 5 แต้มเมื่อแสดงความคิดเห็นในชุมชนและผ่านการแสดงผล",
    points: 5
  },
  wellnessCredit: {
    label: "ใช้ 50 แต้มเพื่อแลกเครดิตดูแลสุขภาพ",
    points: 50
  }
} as const;

export function calculateOrderRewardPoints(amount: Prisma.Decimal): number {
  return Math.max(1, Math.floor(Number(amount) * rewardRules.orderEarnRate.pointsPerThb));
}

export function getRewardExpiryDate(from = new Date()): Date {
  const expiry = new Date(from);
  expiry.setFullYear(expiry.getFullYear() + 1);
  return expiry;
}

export async function awardRewardPoints(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    sourceType: RewardPointSource;
    sourceId: string;
    points: number;
    expiresAt?: Date | null;
  }
): Promise<boolean> {
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`User\` WHERE \`id\` = ${input.userId} FOR UPDATE`
  );

  const existingReward = await tx.rewardPoint.findFirst({
    where: {
      userId: input.userId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      direction: "earn"
    },
    select: {
      id: true
    }
  });

  if (existingReward) {
    return false;
  }

  await tx.rewardPoint.create({
    data: {
      userId: input.userId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      direction: "earn",
      points: input.points,
      expiresAt: input.expiresAt ?? getRewardExpiryDate()
    }
  });

  await tx.user.update({
    where: {
      id: input.userId
    },
    data: {
      rewardBalance: {
        increment: input.points
      }
    }
  });

  return true;
}

export async function spendRewardPoints(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    sourceType: RewardPointSource;
    sourceId: string;
    points: number;
  }
): Promise<void> {
  const user = await tx.user.findUnique({
    where: {
      id: input.userId
    },
    select: {
      rewardBalance: true
    }
  });

  if (!user || user.rewardBalance < input.points) {
    throw new Error("Not enough reward points.");
  }

  await tx.rewardPoint.create({
    data: {
      userId: input.userId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      direction: "spend",
      points: input.points
    }
  });

  await tx.user.update({
    where: {
      id: input.userId
    },
    data: {
      rewardBalance: {
        decrement: input.points
      }
    }
  });
}

export async function reverseOrderRewardPoints(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    orderId: string;
  }
): Promise<number> {
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`User\` WHERE \`id\` = ${input.userId} FOR UPDATE`
  );

  const earnedReward = await tx.rewardPoint.findFirst({
    where: {
      userId: input.userId,
      sourceType: "order",
      sourceId: input.orderId,
      direction: "earn"
    },
    select: {
      points: true
    }
  });

  if (!earnedReward || earnedReward.points <= 0) {
    return 0;
  }

  const existingReversal = await tx.rewardPoint.findFirst({
    where: {
      userId: input.userId,
      sourceType: "order",
      sourceId: input.orderId,
      direction: "adjust"
    },
    select: {
      id: true
    }
  });

  if (existingReversal) {
    return 0;
  }

  await tx.rewardPoint.create({
    data: {
      userId: input.userId,
      sourceType: "order",
      sourceId: input.orderId,
      direction: "adjust",
      points: -earnedReward.points
    }
  });

  await tx.user.update({
    where: {
      id: input.userId
    },
    data: {
      rewardBalance: {
        decrement: earnedReward.points
      }
    }
  });

  return earnedReward.points;
}
