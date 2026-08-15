import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const REQUIRED_MIGRATIONS = [
  "20260809120000_add_payment_normalized_transaction_reference",
  "20260809140000_add_manual_store_refund_fields"
] as const;

const REQUIRED_PAYMENT_COLUMNS = [
  "normalizedTransactionReference",
  "refundTransactionReference",
  "normalizedRefundReference",
  "refundAmount",
  "refundReason",
  "refundedAt",
  "refundedById"
] as const;

const REQUIRED_UNIQUE_INDEXES = [
  "Payment_normalizedTransactionReference_key",
  "Payment_normalizedRefundReference_key"
] as const;

type NameRow = { name: string | null };
type RefundReadinessClient = Pick<PrismaClient, "$queryRaw">;

export type ManualRefundReadiness = {
  status: "ready" | "not_ready" | "unavailable";
  message: string;
};

const READY: ManualRefundReadiness = { status: "ready", message: "พร้อมบันทึกคืนเงิน" };
const NOT_READY: ManualRefundReadiness = {
  status: "not_ready",
  message: "ยังไม่พร้อมบันทึกคืนเงิน กรุณาตรวจ schema ก่อน"
};
const UNAVAILABLE: ManualRefundReadiness = {
  status: "unavailable",
  message: "ไม่สามารถตรวจความพร้อมคืนเงินได้"
};

function includesAll(rows: NameRow[], required: readonly string[]): boolean {
  const found = new Set(rows.map((row) => row.name).filter((name): name is string => Boolean(name)));

  return required.every((name) => found.has(name));
}

/**
 * Checks only the schema prerequisites for manually recording a Store refund.
 * Browser callers receive a deliberately coarse result, never database metadata or errors.
 */
export async function getManualStoreRefundReadiness(
  client: RefundReadinessClient = prisma
): Promise<ManualRefundReadiness> {
  try {
    const [migrations, columns, indexes] = await Promise.all([
      client.$queryRaw<NameRow[]>(Prisma.sql`
        SELECT migration_name AS name
        FROM _prisma_migrations
        WHERE migration_name IN (${Prisma.join(REQUIRED_MIGRATIONS)})
          AND finished_at IS NOT NULL
          AND rolled_back_at IS NULL
      `),
      client.$queryRaw<NameRow[]>(Prisma.sql`
        SELECT COLUMN_NAME AS name
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'Payment'
          AND COLUMN_NAME IN (${Prisma.join(REQUIRED_PAYMENT_COLUMNS)})
      `),
      client.$queryRaw<NameRow[]>(Prisma.sql`
        SELECT INDEX_NAME AS name
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'Payment'
          AND NON_UNIQUE = 0
          AND INDEX_NAME IN (${Prisma.join(REQUIRED_UNIQUE_INDEXES)})
      `)
    ]);

    return includesAll(migrations, REQUIRED_MIGRATIONS) &&
      includesAll(columns, REQUIRED_PAYMENT_COLUMNS) &&
      includesAll(indexes, REQUIRED_UNIQUE_INDEXES)
      ? READY
      : NOT_READY;
  } catch {
    return UNAVAILABLE;
  }
}
