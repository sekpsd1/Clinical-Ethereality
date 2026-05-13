import type { RewardPointDirection, RewardPointSource } from "@prisma/client";

export type CustomerRewardLedgerItem = {
  id: string;
  sourceType: RewardPointSource;
  sourceLabel: string;
  direction: RewardPointDirection;
  points: number;
  signedPoints: string;
  expiresAt: string | null;
  createdAt: string;
};

export type CustomerRewardsData = {
  balance: number;
  expiringSoon: number;
  ledger: CustomerRewardLedgerItem[];
  unavailable?: boolean;
};
