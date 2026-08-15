import { describe, expect, it, vi } from "vitest";
import { getManualStoreRefundReadiness } from "@/features/payments/refund-readiness";

function createClient(results: ReadonlyArray<ReadonlyArray<{ name: string | null }> | Error>) {
  let index = 0;

  return {
    $queryRaw: vi.fn(async () => {
      const result = results[index++];

      if (result instanceof Error) {
        throw result;
      }

      return result;
    })
  };
}

const migrations = [
  { name: "20260809120000_add_payment_normalized_transaction_reference" },
  { name: "20260809140000_add_manual_store_refund_fields" }
];

const columns = [
  { name: "normalizedTransactionReference" },
  { name: "refundTransactionReference" },
  { name: "normalizedRefundReference" },
  { name: "refundAmount" },
  { name: "refundReason" },
  { name: "refundedAt" },
  { name: "refundedById" }
];

const indexes = [
  { name: "Payment_normalizedTransactionReference_key" },
  { name: "Payment_normalizedRefundReference_key" }
];

describe("manual Store refund readiness", () => {
  it("is ready only when the required migrations, columns, and unique indexes are present", async () => {
    const result = await getManualStoreRefundReadiness(createClient([migrations, columns, indexes]) as never);

    expect(result).toEqual({ status: "ready", message: "พร้อมบันทึกคืนเงิน" });
  });

  it.each([
    ["migration", [migrations.slice(0, 1), columns, indexes]],
    ["column", [migrations, columns.slice(0, -1), indexes]],
    ["unique index", [migrations, columns, indexes.slice(0, 1)]]
  ] as const)("is not ready when a required %s is missing", async (_kind, results) => {
    const result = await getManualStoreRefundReadiness(createClient(results) as never);

    expect(result.status).toBe("not_ready");
    expect(result.message).toBe("ยังไม่พร้อมบันทึกคืนเงิน กรุณาตรวจ schema ก่อน");
  });

  it("returns an unavailable result without exposing database errors", async () => {
    const result = await getManualStoreRefundReadiness(
      createClient([new Error("database host must not reach browser"), columns, indexes]) as never
    );

    expect(result).toEqual({ status: "unavailable", message: "ไม่สามารถตรวจความพร้อมคืนเงินได้" });
    expect(result.message).not.toContain("database host");
  });
});
