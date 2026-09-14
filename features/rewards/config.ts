import { getAppEnv } from "@/lib/env/schema";

export class RewardPointsDisabledError extends Error {
  constructor() {
    super("Reward points are unavailable.");
    this.name = "RewardPointsDisabledError";
  }
}

export function isRewardPointsEnabled(): boolean {
  return getAppEnv().ENABLE_REWARD_POINTS;
}

export function assertRewardPointsEnabled(): void {
  if (!isRewardPointsEnabled()) {
    throw new RewardPointsDisabledError();
  }
}
