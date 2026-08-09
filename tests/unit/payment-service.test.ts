import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  applyManualPaymentReview,
  applyProviderPaymentVerification,
  assertPaymentReadyForManualReview,
  assertPaymentReadyForProviderVerification,
  assertProviderVerificationResultPersistable,
  claimProviderPaymentVerification,
  CompletedOrderPaymentConflictError,
  DuplicatePaymentTransactionError,
  getManualPaymentReviewTransition,
  getOrderRewardPointsForPaymentOutcome,
  getPaymentVerificationRetryAfterSeconds,
  getPersistableProviderResult,
  getProviderPaymentVerificationTransition,
  getProviderSlipAttachmentCreateData,
  InventoryFinalizationConflictError,
  mergePaymentVerificationPayload,
  PaymentVerificationConflictError,
  PaymentVerificationRateLimitError,
  ProviderVerificationUnavailableError
} from "@/features/payments/service";
import type { SlipVerificationResult } from "@/lib/payments/slip-verification";
import type { NormalizedHostedAttachment } from "@/lib/storage/attachments";

const verifiedProviderResult: SlipVerificationResult = {
  ok: true,
  provider: "easyslip",
  status: "verified",
  transRef: "transfer-1",
  amount: 1200,
  receiverName: "Clinical Ethereality",
  raw: {
    privateProviderPayload: "must-not-be-persisted-or-returned"
  }
};
const claimedAt = new Date("2026-07-30T12:00:00.000Z");

describe("payment review service", () => {
  it("keeps manually verified orders paid until an admin starts preparation", () => {
    expect(getManualPaymentReviewTransition("verified")).toMatchObject({
      paymentStatus: "verified",
      orderStatus: "paid",
      notificationTitle: "ยืนยันการชำระเงินแล้ว"
    });
  });

  it("maps rejected manual reviews back to pending payment", () => {
    expect(getManualPaymentReviewTransition("rejected")).toMatchObject({
      paymentStatus: "rejected",
      orderStatus: "pending_payment",
      notificationTitle: "สลิปไม่ผ่านการตรวจสอบ"
    });
  });

  it("allows only pending review payments to be manually reviewed", () => {
    expect(() => assertPaymentReadyForManualReview("pending_review")).not.toThrow();
  });

  it.each(["pending_slip", "verified", "rejected", "refunded"] as const)("blocks manual review for %s payments", (status) => {
    expect(() => assertPaymentReadyForManualReview(status)).toThrow("Payment has already been reviewed.");
  });

  it("maps verified provider checks to paid orders", () => {
    expect(getProviderPaymentVerificationTransition(true)).toMatchObject({
      paymentStatus: "verified",
      orderStatus: "paid",
      notificationTitle: "ตรวจสอบสลิปสำเร็จ"
    });
  });

  it("maps rejected provider checks back to pending payment", () => {
    expect(getProviderPaymentVerificationTransition(false)).toMatchObject({
      paymentStatus: "rejected",
      orderStatus: "pending_payment",
      notificationTitle: "ตรวจสอบสลิปไม่ผ่าน"
    });
  });

  it.each(["pending_review", "pending_slip", "rejected"] as const)("allows provider verification for %s payments", (status) => {
    expect(() => assertPaymentReadyForProviderVerification(status)).not.toThrow();
  });

  it.each(["verified", "refunded"] as const)("blocks provider verification for %s payments", (status) => {
    expect(() => assertPaymentReadyForProviderVerification(status)).toThrow("Payment is not ready for slip verification.");
  });

  it("blocks provider errors from being persisted as rejected payments", () => {
    expect(() =>
      assertProviderVerificationResultPersistable({
        ...verifiedProviderResult,
        ok: false,
        status: "provider_error",
        transRef: null
      })
    ).toThrow(ProviderVerificationUnavailableError);
  });

  it("keeps only normalized provider evidence and drops the raw provider payload", () => {
    expect(getPersistableProviderResult(verifiedProviderResult)).toEqual({
      status: "verified",
      transRef: "transfer-1",
      amount: 1200,
      receiverName: "Clinical Ethereality"
    });
    expect(getPersistableProviderResult(verifiedProviderResult)).not.toHaveProperty("raw");
  });

  it("preserves checkout idempotency metadata when payment verification data is merged", () => {
    expect(
      mergePaymentVerificationPayload(
        {
          checkoutRequestId: "checkout-1",
          cartFingerprint: "cart-1",
          source: "customer_checkout_foundation",
          note: "original"
        },
        {
          reviewedAt: "2026-07-30T12:00:00.000Z",
          verificationSource: "easyslip",
          source: "must-not-replace-original"
        }
      )
    ).toEqual({
      checkoutRequestId: "checkout-1",
      cartFingerprint: "cart-1",
      source: "customer_checkout_foundation",
      note: "original",
      reviewedAt: "2026-07-30T12:00:00.000Z",
      verificationSource: "easyslip"
    });
  });

  it("calculates rejected-payment retry cooldown from persisted review timestamps", () => {
    const now = new Date("2026-07-30T12:00:30.000Z");

    expect(
      getPaymentVerificationRetryAfterSeconds(
        {
          status: "rejected",
          reviewedAt: new Date("2026-07-30T12:00:10.500Z"),
          updatedAt: new Date("2026-07-30T12:00:05.000Z")
        },
        now
      )
    ).toBe(11);
    expect(
      getPaymentVerificationRetryAfterSeconds(
        {
          status: "rejected",
          reviewedAt: new Date("2026-07-30T11:59:00.000Z"),
          updatedAt: new Date("2026-07-30T11:59:00.000Z")
        },
        now
      )
    ).toBe(0);
    expect(
      getPaymentVerificationRetryAfterSeconds(
        {
          status: "pending_review",
          reviewedAt: null,
          updatedAt: new Date("2026-07-30T12:00:10.500Z")
        },
        now
      )
    ).toBe(11);
    expect(
      getPaymentVerificationRetryAfterSeconds(
        {
          status: "pending_slip",
          reviewedAt: null,
          updatedAt: now
        },
        now
      )
    ).toBe(0);
  });

  it("awards order points only after a verified payment outcome", () => {
    const amount = new Prisma.Decimal(1200);

    expect(getOrderRewardPointsForPaymentOutcome("verified", amount)).toBe(120);
    expect(getOrderRewardPointsForPaymentOutcome("rejected", amount)).toBe(0);
    expect(getOrderRewardPointsForPaymentOutcome("provider_error", amount)).toBe(0);
  });

  it("claims submitted QR evidence before provider verification and preserves checkout metadata", async () => {
    const previousUpdatedAt = new Date(Date.now() - 60_000);
    const paymentUpdateMany = vi.fn().mockResolvedValue({
      count: 1
    });
    const orderUpdateMany = vi.fn().mockResolvedValue({
      count: 1
    });
    const tx = {
      payment: {
        findUnique: vi.fn().mockResolvedValue({
          id: "payment-1",
          orderId: "order-1",
          amount: new Prisma.Decimal(1200),
          status: "pending_slip",
          slipImageUrl: null,
          verificationPayload: {
            checkoutRequestId: "checkout-1",
            cartFingerprint: "cart-1",
            source: "customer_checkout_foundation"
          },
          reviewedAt: null,
          updatedAt: previousUpdatedAt,
          order: {
            userId: "customer-1"
          }
        }),
        updateMany: paymentUpdateMany
      },
      order: {
        updateMany: orderUpdateMany
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({
          id: "audit-1"
        })
      }
    } as unknown as Prisma.TransactionClient;

    const claimedPayment = await claimProviderPaymentVerification(tx, {
      actorId: "customer-1",
      expectedOrderId: "order-1",
      expectedOrderUserId: "customer-1",
      hostedSlipAttachment: null,
      paymentId: "payment-1",
      qrPayload: "submitted-slip-qr",
      source: "qr_payload"
    });

    expect(paymentUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "payment-1",
        status: "pending_slip",
        updatedAt: previousUpdatedAt
      },
      data: {
        status: "pending_review",
        slipImageUrl: null,
        verificationPayload: expect.objectContaining({
          checkoutRequestId: "checkout-1",
          cartFingerprint: "cart-1",
          source: "customer_checkout_foundation",
          submissionSource: "qr_payload",
          submittedEvidence: expect.objectContaining({
            type: "qr_payload",
            qrPayload: "submitted-slip-qr"
          })
        }),
        updatedAt: expect.any(Date)
      }
    });
    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "order-1",
        status: {
          in: ["pending_payment", "payment_review"]
        }
      },
      data: {
        status: "payment_review"
      }
    });
    expect(claimedPayment).toMatchObject({
      id: "payment-1",
      orderId: "order-1",
      orderUserId: "customer-1",
      status: "pending_review",
      verificationPayload: expect.objectContaining({
        checkoutRequestId: "checkout-1",
        cartFingerprint: "cart-1",
        source: "customer_checkout_foundation",
        submittedEvidence: expect.objectContaining({
          qrPayload: "submitted-slip-qr"
        })
      })
    });
    expect(claimedPayment.updatedAt).toEqual(paymentUpdateMany.mock.calls[0][0].data.updatedAt);
  });

  it("persists a hosted slip attachment as part of the evidence claim", async () => {
    const hostedSlipAttachment: NormalizedHostedAttachment = {
      storageUrl: "https://cdn.example.com/slips/payment-1.png",
      storageKey: "slips/payment-1.png",
      fileName: "payment-1.png",
      mimeType: "image/png",
      byteSize: 12345,
      storageProvider: "s3",
      storageConfigured: true
    };
    const attachmentCreate = vi.fn().mockResolvedValue({
      id: "attachment-1"
    });
    const tx = {
      payment: {
        findUnique: vi.fn().mockResolvedValue({
          id: "payment-1",
          orderId: "order-1",
          amount: new Prisma.Decimal(1200),
          status: "rejected",
          slipImageUrl: null,
          verificationPayload: {
            source: "prescription_order"
          },
          reviewedAt: new Date(Date.now() - 60_000),
          updatedAt: new Date(Date.now() - 60_000),
          order: {
            userId: "customer-1"
          }
        }),
        updateMany: vi.fn().mockResolvedValue({
          count: 1
        })
      },
      order: {
        updateMany: vi.fn().mockResolvedValue({
          count: 1
        })
      },
      fileAttachment: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: attachmentCreate
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({
          id: "audit-1"
        })
      }
    } as unknown as Prisma.TransactionClient;

    const claimedPayment = await claimProviderPaymentVerification(tx, {
      actorId: "customer-1",
      expectedOrderId: "order-1",
      expectedOrderUserId: "customer-1",
      hostedSlipAttachment,
      paymentId: "payment-1",
      qrPayload: null,
      source: "image_url"
    });

    expect(claimedPayment).toMatchObject({
      status: "pending_review",
      slipImageUrl: hostedSlipAttachment.storageUrl,
      verificationPayload: expect.objectContaining({
        source: "prescription_order",
        submittedEvidence: expect.objectContaining({
          type: "image_url",
          imageUrl: hostedSlipAttachment.storageUrl
        })
      })
    });
    expect(attachmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityId: "payment-1",
        ownerId: "customer-1",
        purpose: "payment_slip",
        storageUrl: hostedSlipAttachment.storageUrl
      })
    });
  });

  it("throttles a recently claimed pending-review payment from persisted timestamps", async () => {
    const paymentUpdateMany = vi.fn();
    const tx = {
      payment: {
        findUnique: vi.fn().mockResolvedValue({
          id: "payment-1",
          orderId: "order-1",
          amount: new Prisma.Decimal(1200),
          status: "pending_review",
          slipImageUrl: null,
          verificationPayload: {
            source: "customer_checkout_foundation"
          },
          reviewedAt: null,
          updatedAt: new Date(),
          order: {
            userId: "customer-1"
          }
        }),
        updateMany: paymentUpdateMany
      }
    } as unknown as Prisma.TransactionClient;

    await expect(
      claimProviderPaymentVerification(tx, {
        actorId: "customer-1",
        expectedOrderId: "order-1",
        expectedOrderUserId: "customer-1",
        hostedSlipAttachment: null,
        paymentId: "payment-1",
        qrPayload: "submitted-slip-qr",
        source: "qr_payload"
      })
    ).rejects.toBeInstanceOf(PaymentVerificationRateLimitError);

    expect(paymentUpdateMany).not.toHaveBeenCalled();
  });

  it("blocks a concurrent evidence claim that loses the payment CAS", async () => {
    const orderUpdateMany = vi.fn();
    const tx = {
      payment: {
        findUnique: vi.fn().mockResolvedValue({
          id: "payment-1",
          orderId: "order-1",
          amount: new Prisma.Decimal(1200),
          status: "pending_slip",
          slipImageUrl: null,
          verificationPayload: null,
          reviewedAt: null,
          updatedAt: new Date(Date.now() - 60_000),
          order: {
            userId: "customer-1"
          }
        }),
        updateMany: vi.fn().mockResolvedValue({
          count: 0
        })
      },
      order: {
        updateMany: orderUpdateMany
      }
    } as unknown as Prisma.TransactionClient;

    await expect(
      claimProviderPaymentVerification(tx, {
        actorId: "customer-1",
        expectedOrderId: "order-1",
        expectedOrderUserId: "customer-1",
        hostedSlipAttachment: null,
        paymentId: "payment-1",
        qrPayload: "submitted-slip-qr",
        source: "qr_payload"
      })
    ).rejects.toBeInstanceOf(PaymentVerificationConflictError);

    expect(orderUpdateMany).not.toHaveBeenCalled();
  });

  it("blocks a verified transaction reference that was already used by another payment", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "payment-2"
    });
    const tx = {
      payment: {
        findFirst
      }
    } as unknown as Prisma.TransactionClient;

    await expect(
      applyProviderPaymentVerification(tx, {
        actorId: "customer-1",
        payment: {
          id: "payment-1",
          orderId: "order-1",
          orderUserId: "customer-1",
          amount: new Prisma.Decimal(1200),
          status: "pending_review",
          slipImageUrl: null,
          verificationPayload: null,
          updatedAt: claimedAt
        },
        result: verifiedProviderResult,
        source: "qr_payload"
      })
    ).rejects.toThrow(DuplicatePaymentTransactionError);

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: {
          not: "payment-1"
        },
        status: {
          in: ["verified", "refunded"]
        },
        normalizedTransactionReference: "TRANSFER1"
      },
      select: {
        id: true
      }
    });
  });

  it("blocks a second completed payment for the same order", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "payment-2"
      });
    const tx = {
      payment: {
        findFirst
      }
    } as unknown as Prisma.TransactionClient;

    await expect(
      applyProviderPaymentVerification(tx, {
        actorId: "customer-1",
        payment: {
          id: "payment-1",
          orderId: "order-1",
          orderUserId: "customer-1",
          amount: new Prisma.Decimal(1200),
          status: "pending_review",
          slipImageUrl: null,
          verificationPayload: null,
          updatedAt: claimedAt
        },
        result: verifiedProviderResult,
        source: "qr_payload"
      })
    ).rejects.toThrow(CompletedOrderPaymentConflictError);

    expect(findFirst).toHaveBeenLastCalledWith({
      where: {
        id: {
          not: "payment-1"
        },
        orderId: "order-1",
        status: {
          in: ["verified", "refunded"]
        }
      },
      select: {
        id: true
      }
    });
  });

  it("persists verified payment rewards through the shared payment transaction", async () => {
    const rewardPointCreate = vi.fn().mockResolvedValue({
      id: "reward-1"
    });
    const notificationCreate = vi.fn().mockResolvedValue({
      id: "notification-1"
    });
    const paymentUpdateMany = vi.fn().mockResolvedValue({
      count: 1
    });
    const inventoryUpdateMany = vi.fn().mockResolvedValue({
      count: 1
    });
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "customer-1"
        }
      ]),
      payment: {
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: paymentUpdateMany
      },
      order: {
        updateMany: vi.fn().mockResolvedValue({
          count: 1
        })
      },
      orderItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            productId: "product-1",
            quantity: 2
          },
          {
            productId: "product-1",
            quantity: 1
          }
        ])
      },
      inventory: {
        updateMany: inventoryUpdateMany
      },
      notification: {
        create: notificationCreate
      },
      rewardPoint: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: rewardPointCreate
      },
      user: {
        update: vi.fn().mockResolvedValue({
          id: "customer-1"
        })
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({
          id: "audit-1"
        })
      }
    } as unknown as Prisma.TransactionClient;

    await applyProviderPaymentVerification(tx, {
      actorId: "customer-1",
      payment: {
        id: "payment-1",
        orderId: "order-1",
        orderUserId: "customer-1",
        amount: new Prisma.Decimal(1200),
        status: "pending_review",
        slipImageUrl: null,
        verificationPayload: {
          checkoutRequestId: "checkout-1",
          cartFingerprint: "cart-1",
          source: "customer_checkout_foundation"
        },
        updatedAt: claimedAt
      },
      result: verifiedProviderResult,
      source: "qr_payload"
    });

    expect(rewardPointCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "customer-1",
        sourceType: "order",
        sourceId: "order-1",
        direction: "earn",
        points: 120
      })
    });
    expect(notificationCreate).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(paymentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "payment-1",
          status: "pending_review",
          updatedAt: claimedAt
        },
        data: expect.objectContaining({
          normalizedTransactionReference: "TRANSFER1",
          verificationPayload: expect.objectContaining({
            checkoutRequestId: "checkout-1",
            cartFingerprint: "cart-1",
            source: "customer_checkout_foundation",
            verificationSource: "easyslip"
          })
        })
      })
    );
    expect(inventoryUpdateMany).toHaveBeenCalledWith({
      where: {
        productId: "product-1",
        quantity: {
          gte: 3
        },
        reservedQuantity: {
          gte: 3
        }
      },
      data: {
        quantity: {
          decrement: 3
        },
        reservedQuantity: {
          decrement: 3
        }
      }
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "customer-1",
        action: "inventory.consume_reservation",
        entityType: "product",
        entityId: "product-1",
        metadataJson: expect.objectContaining({
          orderId: "order-1",
          paymentId: "payment-1",
          quantity: 3,
          source: "provider_verification"
        })
      })
    });
  });

  it("blocks a stale or backward order transition with a payment-ready status CAS", async () => {
    const tx = {
      payment: {
        updateMany: vi.fn().mockResolvedValue({
          count: 1
        })
      },
      order: {
        updateMany: vi.fn().mockResolvedValue({
          count: 0
        })
      }
    } as unknown as Prisma.TransactionClient;

    await expect(
      applyProviderPaymentVerification(tx, {
        actorId: "customer-1",
        payment: {
          id: "payment-1",
          orderId: "order-1",
          orderUserId: "customer-1",
          amount: new Prisma.Decimal(1200),
          status: "pending_review",
          slipImageUrl: null,
          verificationPayload: null,
          updatedAt: claimedAt
        },
        result: {
          ...verifiedProviderResult,
          ok: false,
          status: "rejected",
          transRef: null
        },
        source: "qr_payload"
      })
    ).rejects.toThrow(PaymentVerificationConflictError);

    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: "order-1",
        status: {
          in: ["payment_review"]
        },
        createdAt: {
          gt: expect.any(Date)
        }
      },
      data: {
        status: "pending_payment"
      }
    });
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          normalizedTransactionReference: null
        })
      })
    );
  });

  it("aborts verified payment finalization when reserved stock cannot be consumed", async () => {
    const notificationCreate = vi.fn();
    const tx = {
      payment: {
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({
          count: 1
        })
      },
      order: {
        updateMany: vi.fn().mockResolvedValue({
          count: 1
        })
      },
      orderItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            productId: "product-1",
            quantity: 2
          }
        ])
      },
      inventory: {
        updateMany: vi.fn().mockResolvedValue({
          count: 0
        })
      },
      notification: {
        create: notificationCreate
      }
    } as unknown as Prisma.TransactionClient;

    await expect(
      applyProviderPaymentVerification(tx, {
        actorId: "customer-1",
        payment: {
          id: "payment-1",
          orderId: "order-1",
          orderUserId: "customer-1",
          amount: new Prisma.Decimal(1200),
          status: "pending_review",
          slipImageUrl: null,
          verificationPayload: null,
          updatedAt: claimedAt
        },
        result: verifiedProviderResult,
        source: "qr_payload"
      })
    ).rejects.toThrow(InventoryFinalizationConflictError);

    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["verified", 1],
    ["rejected", 0]
  ] as const)("awards manual-review points only for %s payments", async (status, expectedRewardCreates) => {
    const rewardPointCreate = vi.fn().mockResolvedValue({
      id: "reward-1"
    });
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "customer-1"
        }
      ]),
      payment: {
        findUnique: vi.fn().mockResolvedValue({
          id: "payment-1",
          orderId: "order-1",
          amount: new Prisma.Decimal(1200),
          status: "pending_review",
          verificationPayload: {
            checkoutRequestId: "checkout-1",
            source: "customer_checkout_foundation"
          },
          order: {
            userId: "customer-1"
          }
        }),
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({
          count: 1
        })
      },
      order: {
        updateMany: vi.fn().mockResolvedValue({
          count: 1
        })
      },
      orderItem: {
        findMany: vi.fn().mockResolvedValue([])
      },
      inventory: {
        updateMany: vi.fn().mockResolvedValue({
          count: 1
        })
      },
      notification: {
        create: vi.fn().mockResolvedValue({
          id: "notification-1"
        })
      },
      rewardPoint: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: rewardPointCreate
      },
      user: {
        update: vi.fn().mockResolvedValue({
          id: "customer-1"
        })
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({
          id: "audit-1"
        })
      }
    } as unknown as Prisma.TransactionClient;

    await applyManualPaymentReview(tx, {
      actorId: "admin-1",
      paymentId: "payment-1",
      status,
      transactionReference: status === "verified" ? "manual-reference-1" : undefined
    });

    expect(rewardPointCreate).toHaveBeenCalledTimes(expectedRewardCreates);
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "order-1",
          status: {
            in: ["payment_review"]
          },
          createdAt: {
            gt: expect.any(Date)
          }
        })
      })
    );
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          normalizedTransactionReference: status === "verified" ? "MANUALREFERENCE1" : null
        })
      })
    );
  });

  it("creates payment slip attachment metadata only when a hosted slip URL exists", () => {
    const hostedSlipAttachment: NormalizedHostedAttachment = {
      storageUrl: "https://cdn.example.com/slips/payment-1.png",
      storageKey: "slips/payment-1.png",
      fileName: "payment-1.png",
      mimeType: "image/png",
      byteSize: 12345,
      storageProvider: "s3",
      storageConfigured: true
    };

    expect(
      getProviderSlipAttachmentCreateData({
        hostedSlipAttachment: null,
        orderId: "order-1",
        ownerId: "user-1",
        paymentId: "payment-1"
      })
    ).toBeNull();
    expect(
      getProviderSlipAttachmentCreateData({
        hostedSlipAttachment,
        orderId: "order-1",
        ownerId: "user-1",
        paymentId: "payment-1"
      })
    ).toMatchObject({
      ownerId: "user-1",
      purpose: "payment_slip",
      entityType: "payment",
      entityId: "payment-1",
      storageUrl: "https://cdn.example.com/slips/payment-1.png",
      storageKey: "slips/payment-1.png",
      fileName: "payment-1.png",
      metadataJson: {
        orderId: "order-1",
        source: "payment_slip_verification",
        storageProvider: "s3",
        storageConfigured: true
      }
    });
  });
});
