import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  canReuseCheckoutOrder,
  createCartFingerprint,
  findExistingCheckoutOrder
} from "@/features/products/checkout/idempotency";
import {
  createStorePromptPayPayload,
  isSupportedPromptPayId
} from "@/features/products/checkout/payment";

describe("store checkout idempotency", () => {
  it("creates one stable fingerprint from normalized cart quantities", () => {
    const first = createCartFingerprint([
      { slug: "vitamin-c", quantity: 1 },
      { slug: "home-test", quantity: 2 },
      { slug: "vitamin-c", quantity: 2 }
    ]);
    const reordered = createCartFingerprint([
      { slug: "home-test", quantity: 2 },
      { slug: "vitamin-c", quantity: 3 }
    ]);
    const changed = createCartFingerprint([
      { slug: "home-test", quantity: 2 },
      { slug: "vitamin-c", quantity: 4 }
    ]);

    expect(first).toBe(reordered);
    expect(first).not.toBe(changed);
  });

  it("reuses an order only when its durable cart fingerprint matches", () => {
    expect(
      canReuseCheckoutOrder(
        {
          orderId: "order-1",
          cartFingerprint: "fingerprint-1"
        },
        "fingerprint-1"
      )
    ).toBe(true);
    expect(
      canReuseCheckoutOrder(
        {
          orderId: "order-1",
          cartFingerprint: "fingerprint-1"
        },
        "fingerprint-2"
      )
    ).toBe(false);
    expect(
      canReuseCheckoutOrder(
        {
          orderId: "legacy-order",
          cartFingerprint: null
        },
        "fingerprint-1"
      )
    ).toBe(false);
  });

  it("finds an idempotent checkout by JSON path without a time window or row limit", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      orderId: "order-1",
      verificationPayload: {
        checkoutRequestId: "request-1",
        cartFingerprint: "fingerprint-1"
      }
    });
    const tx = {
      payment: {
        findFirst
      }
    } as unknown as Prisma.TransactionClient;

    await expect(
      findExistingCheckoutOrder(tx, "customer-1", "request-1")
    ).resolves.toEqual({
      orderId: "order-1",
      cartFingerprint: "fingerprint-1"
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        order: {
          userId: "customer-1"
        },
        verificationPayload: {
          path: "$.checkoutRequestId",
          equals: "request-1"
        }
      },
      select: {
        orderId: true,
        verificationPayload: true
      }
    });
  });

  it("treats legacy checkout metadata without a cart fingerprint as unsafe to reuse", async () => {
    const tx = {
      payment: {
        findFirst: vi.fn().mockResolvedValue({
          orderId: "order-1",
          verificationPayload: {
            checkoutRequestId: "request-1"
          }
        })
      }
    } as unknown as Prisma.TransactionClient;

    await expect(
      findExistingCheckoutOrder(tx, "customer-1", "request-1")
    ).resolves.toEqual({
      orderId: "order-1",
      cartFingerprint: null
    });
  });
});

describe("store checkout PromptPay readiness", () => {
  it.each([
    "0812345678",
    "1-2345-67890-12-3",
    "123456789012345"
  ])("accepts a supported PromptPay proxy: %s", (promptPayId) => {
    expect(isSupportedPromptPayId(promptPayId)).toBe(true);
  });

  it.each([undefined, "", "1234", "not-a-promptpay-id"])(
    "blocks missing or unsupported PromptPay configuration: %s",
    (promptPayId) => {
      expect(isSupportedPromptPayId(promptPayId)).toBe(false);
    }
  );

  it("does not create a payload for an invalid order amount", () => {
    expect(createStorePromptPayPayload(0, "0812345678")).toBeNull();
    expect(createStorePromptPayPayload(Number.NaN, "0812345678")).toBeNull();
  });

  it("does not create a payload from an unsupported PromptPay id", () => {
    expect(createStorePromptPayPayload(1200, "not-a-promptpay-id")).toBeNull();
    expect(createStorePromptPayPayload(1200, "1234")).toBeNull();
  });

  it("creates a non-empty payload only when configuration and amount are valid", () => {
    expect(createStorePromptPayPayload(1200, "0812345678")).toMatch(/^000201/);
  });
});
