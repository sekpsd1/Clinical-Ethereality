import type { ConsentType } from "@prisma/client";

export type CustomerConsentItem = {
  type: ConsentType;
  title: string;
  version: string;
  required: boolean;
  summary: string;
  bullets: string[];
  accepted: boolean;
  acceptedAt: string | null;
};

export type CustomerConsentData = {
  items: CustomerConsentItem[];
  acceptedCount: number;
  requiredCount: number;
  unavailable?: boolean;
};
