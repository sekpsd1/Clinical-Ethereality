import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

config({ path: ".env.local", quiet: true });

const { prisma } = await import("@/lib/db/prisma");

const describeWithLocalDatabase =
  process.env.RUN_LOCAL_DB_INTEGRATION === "true" ? describe : describe.skip;

describeWithLocalDatabase("Payment transaction reference Local DB integration", () => {
  const fixtureKey = randomUUID();
  let userId = "";
  let firstOrderId = "";
  let secondOrderId = "";
  let firstPaymentId = "";
  let secondPaymentId = "";

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        lineUserId: `payment-reference-${fixtureKey}`,
        displayName: "Payment reference integration",
        role: "customer",
        status: "active"
      },
      select: { id: true }
    });
    userId = user.id;

    const [firstOrder, secondOrder] = await Promise.all(
      ["first", "second"].map(() =>
        prisma.order.create({
          data: {
            userId,
            status: "payment_review",
            subtotal: 100,
            grandTotal: 100,
            payments: {
              create: {
                amount: 100,
                status: "pending_review"
              }
            }
          },
          include: {
            payments: {
              select: { id: true }
            }
          }
        })
      )
    );

    firstOrderId = firstOrder.id;
    secondOrderId = secondOrder.id;
    firstPaymentId = firstOrder.payments[0]!.id;
    secondPaymentId = secondOrder.payments[0]!.id;
  });

  afterAll(async () => {
    const orderIds = [firstOrderId, secondOrderId].filter(Boolean);

    if (orderIds.length > 0) {
      await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }

    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  it("allows legacy and non-completed rows to remain null without inferring JSON evidence", async () => {
    await prisma.payment.update({
      where: { id: firstPaymentId },
      data: {
        status: "rejected",
        verificationPayload: {
          result: {
            transRef: "legacy-reference-not-backfilled"
          }
        }
      }
    });

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: firstPaymentId },
      select: {
        normalizedTransactionReference: true,
        verificationPayload: true
      }
    });

    expect(payment.normalizedTransactionReference).toBeNull();
    expect(payment.verificationPayload).toMatchObject({
      result: { transRef: "legacy-reference-not-backfilled" }
    });
  });

  it("allows exactly one concurrent completed-payment transition for a normalized reference", async () => {
    await prisma.payment.update({
      where: { id: firstPaymentId },
      data: { status: "pending_review" }
    });

    const results = await Promise.allSettled([
      prisma.$transaction((tx) =>
        tx.payment.update({
          where: { id: firstPaymentId },
          data: {
            status: "verified",
            normalizedTransactionReference: "CONCURRENTREFERENCE1"
          }
        })
      ),
      prisma.$transaction((tx) =>
        tx.payment.update({
          where: { id: secondPaymentId },
          data: {
            status: "verified",
            normalizedTransactionReference: "CONCURRENTREFERENCE1"
          }
        })
      )
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const payments = await prisma.payment.findMany({
      where: { id: { in: [firstPaymentId, secondPaymentId] } },
      select: {
        id: true,
        status: true,
        normalizedTransactionReference: true
      }
    });

    expect(
      payments.filter((payment) => payment.normalizedTransactionReference === "CONCURRENTREFERENCE1")
    ).toHaveLength(1);
    expect(payments.filter((payment) => payment.status === "verified")).toHaveLength(1);
    expect(payments.filter((payment) => payment.status === "pending_review")).toHaveLength(1);
    expect(payments.find((payment) => payment.status === "pending_review")?.normalizedTransactionReference).toBeNull();
  });
});
