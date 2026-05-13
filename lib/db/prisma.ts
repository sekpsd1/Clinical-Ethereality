import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var clinicalEtherealityPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.clinicalEtherealityPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.clinicalEtherealityPrisma = prisma;
}
