import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  applyManualConsultationPaymentReview,
  recordConsultationProviderFailure
} from "@/features/consultations/payment/manual-review";
import { manualConsultationPaymentReviewSchema } from "@/features/admin/payments/schema";

const now = new Date("2026-09-05T06:00:00.000Z");
const scheduledAt = new Date("2026-09-06T02:00:00.000Z");

function txMock(overrides: {
  consultationStatus?: "pending_payment" | "scheduled" | "reschedule_required";
  expiresAt?: Date | null;
  paymentStatus?: "pending_review" | "verified";
  normalizedReference?: string | null;
  verificationPayload?: Prisma.JsonValue;
} = {}) {
  const consultationStatus = overrides.consultationStatus ?? "pending_payment";
  const paymentStatus = overrides.paymentStatus ?? "pending_review";
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "locked" }]),
    auditLog: { create: vi.fn() },
    consultation: {
      findUnique: vi.fn().mockResolvedValue({
        id: "consultation-1",
        patientId: "patient-1",
        doctorId: "doctor-1",
        createdAt: new Date("2026-09-05T02:00:00.000Z"),
        scheduledAt,
        slotLockId: consultationStatus === "reschedule_required" ? null : "lock-1",
        status: consultationStatus,
        doctor: { userId: "doctor-user-1" },
        slotLock:
          consultationStatus === "reschedule_required"
            ? null
            : {
                id: "lock-1",
                doctorId: "doctor-1",
                patientId: "patient-1",
                scheduledAt,
                expiresAt:
                  overrides.expiresAt === undefined
                    ? new Date("2026-09-05T07:00:00.000Z")
                    : overrides.expiresAt
              },
        payment: {
          id: "payment-1",
          amount: new Prisma.Decimal("900.00"),
          status: paymentStatus,
          updatedAt: new Date("2026-09-05T05:00:00.000Z"),
          normalizedTransactionReference:
            overrides.normalizedReference ?? null,
          reviewedById: null,
          verificationPayload:
            overrides.verificationPayload ?? {
              providerAttempt: {
                outcome: "provider_error",
                failedAt: "2026-09-05T04:00:00.000Z"
              }
            }
        }
      }),
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    consultationSlotLock: { deleteMany: vi.fn() },
    fileAttachment: {
      findFirst: vi.fn().mockResolvedValue({ id: "attachment-1" })
    },
    notification: { create: vi.fn() },
    payment: {
      findUnique: vi.fn().mockResolvedValue({ consultationId: "consultation-1" }),
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    }
  };
}

function input(overrides: Partial<Parameters<typeof applyManualConsultationPaymentReview>[1]> = {}) {
  return {
    actorId: "admin-1",
    amount: "900.00",
    customerReportedAt: new Date("2026-09-05T04:30:00.000Z"),
    paymentId: "payment-1",
    reasonCode: "provider_unavailable" as const,
    transactionReference: " bank-reference-1 ",
    transferredAt: new Date("2026-09-05T03:30:00.000Z"),
    ...overrides
  };
}

describe("manual consultation payment review", () => {
  it("records only a sanitized provider-failure marker for an owned pending payment", async () => {
    const tx = txMock();

    await recordConsultationProviderFailure(tx as never, {
      actorId: "patient-1",
      consultationId: "consultation-1",
      provider: "slipok"
    });

    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          verificationPayload: expect.objectContaining({
            providerAttempt: expect.objectContaining({
              outcome: "provider_error",
              provider: "slipok"
            })
          })
        }
      })
    );
    expect(JSON.stringify(tx.payment.updateMany.mock.calls[0])).not.toContain(
      "transactionReference"
    );
  });

  it("validates exact Bangkok timestamps and normalizes bank references", () => {
    const valid = manualConsultationPaymentReviewSchema.safeParse({
      paymentId: "payment-1",
      amount: "900.00",
      transactionReference: " bank-reference-1 ",
      transferredAt: "2026-09-05T10:30",
      customerReportedAt: "2026-09-05T11:30",
      reasonCode: "provider_unavailable",
      confirmedExternalBankCheck: "true"
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.transactionReference).toBe("BANKREFERENCE1");
      expect(valid.data.transferredAt.toISOString()).toBe(
        "2026-09-05T03:30:00.000Z"
      );
    }
    expect(
      manualConsultationPaymentReviewSchema.safeParse({
        paymentId: "payment-1",
        amount: "900.00",
        transactionReference: "ภาษาไทย",
        transferredAt: "2026-02-30T10:30",
        customerReportedAt: "2026-09-05T11:30",
        reasonCode: "provider_unavailable",
        confirmedExternalBankCheck: "true"
      }).success
    ).toBe(false);
  });

  it("locks consultation then payment, verifies the payment, and retains an active slot", async () => {
    const tx = txMock();

    const outcome = await applyManualConsultationPaymentReview(
      tx as never,
      input(),
      now
    );

    expect(outcome).toBe("scheduled");
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "verified",
          normalizedTransactionReference: "BANKREFERENCE1",
          reviewedById: "admin-1"
        })
      })
    );
    expect(tx.consultation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "scheduled" } })
    );
    expect(tx.notification.create).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "consultation.payment_manual_review"
        })
      })
    );
  });

  it("keeps verified funds but releases an expired slot for customer rescheduling", async () => {
    const tx = txMock({ expiresAt: new Date("2026-09-05T05:59:59.000Z") });

    const outcome = await applyManualConsultationPaymentReview(
      tx as never,
      input(),
      now
    );

    expect(outcome).toBe("reschedule_required");
    expect(tx.consultation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "reschedule_required", slotLockId: null }
      })
    );
    expect(tx.consultationSlotLock.deleteMany).toHaveBeenCalledWith({
      where: { id: "lock-1" }
    });
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
  });

  it("rejects customer contact outside the 24-hour provider-failure window", async () => {
    const tx = txMock();

    await expect(
      applyManualConsultationPaymentReview(
        tx as never,
        input({ customerReportedAt: new Date("2026-09-06T04:00:01.000Z") }),
        new Date("2026-09-06T05:00:00.000Z")
      )
    ).rejects.toMatchObject({
      code: "INVALID_CONTACT_WINDOW"
    });
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a reference already used by a verified payment", async () => {
    const tx = txMock();
    tx.payment.findFirst.mockResolvedValueOnce({ id: "payment-2" });

    await expect(
      applyManualConsultationPaymentReview(tx as never, input(), now)
    ).rejects.toMatchObject({
      code: "DUPLICATE_REFERENCE"
    });
  });

  it("returns an idempotent outcome for the same completed manual review", async () => {
    const tx = txMock({
      consultationStatus: "scheduled",
      paymentStatus: "verified",
      normalizedReference: "BANKREFERENCE1",
      verificationPayload: {
        manualReview: { verificationSource: "line_oa_external_bank" }
      }
    });

    await expect(
      applyManualConsultationPaymentReview(tx as never, input(), now)
    ).resolves.toBe("already_processed");
    expect(tx.fileAttachment.findFirst).not.toHaveBeenCalled();
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
  });
});
