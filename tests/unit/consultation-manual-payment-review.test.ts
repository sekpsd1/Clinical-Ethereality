import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  applyManualAppointmentPaymentDecision,
  applyManualConsultationPaymentReview,
  createManualAppointmentPaymentIntake,
  ManualAppointmentIntakeError,
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
        patient: {
          role: "customer",
          status: "active",
          fullName: "Verified Patient",
          dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
          phone: "0812345678",
          normalizedPhone: "+66812345678",
          phoneVerifiedAt: new Date("2026-09-01T00:00:00.000Z")
        },
        doctor: {
          userId: "doctor-user-1",
          status: "approved",
          user: { status: "active" }
        },
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

function manualAppointmentPayload() {
  return {
    manualAppointmentIntake: {
      version: 1,
      source: "admin_manual_appointment",
      attachmentId: "attachment-1",
      createdAt: "2026-09-05T05:00:00.000Z",
      createdById: "admin-1",
      reasonCode: "provider_unavailable",
      transferredAt: "2026-09-05T04:30:00.000Z"
    }
  } satisfies Prisma.JsonObject;
}

function intakeTxMock() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "patient-1" }]),
    auditLog: { create: vi.fn() },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        role: "customer",
        status: "active",
        fullName: "Verified Patient",
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        phone: "0812345678",
        normalizedPhone: "+66812345678",
        phoneVerifiedAt: new Date("2026-09-01T00:00:00.000Z")
      })
    },
    doctorAvailability: {
      findUnique: vi.fn().mockResolvedValue({
        id: "availability-1",
        doctorId: "doctor-1",
        weekday: 1,
        startTime: "09:00",
        endTime: "10:00",
        slotMinutes: 30,
        effectiveFrom: null,
        effectiveTo: null,
        isActive: true,
        doctor: {
          id: "doctor-1",
          status: "approved",
          consultationFee: 900,
          user: { status: "active" }
        }
      })
    },
    doctorAvailabilityDateOverride: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null)
    },
    consultation: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "consultation-1" })
    },
    consultationSlotLock: {
      create: vi.fn().mockResolvedValue({ id: "lock-1" })
    },
    payment: {
      create: vi.fn().mockResolvedValue({ id: "payment-1" })
    },
    fileAttachment: { create: vi.fn() },
    notification: { create: vi.fn() }
  };
}

function preparedEvidence() {
  return {
    attachmentId: "attachment-1",
    byteSize: 128,
    cleanup: vi.fn(),
    fileName: "slip.png",
    mimeType: "image/png" as const,
    storageKey: "payments/private/slip.png",
    storageUrl: "/api/payments/slips/attachment-1"
  };
}

describe("admin manual appointment payment intake and review", () => {
  it("creates only pending records with private evidence and a bounded slot lock", async () => {
    const tx = intakeTxMock();

    const result = await createManualAppointmentPaymentIntake(
      tx as never,
      {
        actorId: "admin-1",
        availabilityId: "availability-1",
        doctorId: "doctor-1",
        evidence: preparedEvidence(),
        patientId: "patient-1",
        reasonCode: "provider_unavailable",
        scheduledAt: new Date("2026-09-07T02:00:00.000Z"),
        transferredAt: new Date("2026-09-05T05:30:00.000Z")
      },
      now
    );

    expect(result).toEqual({
      consultationId: "consultation-1",
      paymentId: "payment-1",
      status: "created"
    });
    expect(tx.consultation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "pending_payment" })
      })
    );
    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "pending_review",
          verificationPayload: expect.objectContaining({
            manualAppointmentIntake: expect.objectContaining({
              source: "admin_manual_appointment",
              reasonCode: "provider_unavailable"
            })
          })
        })
      })
    );
    expect(tx.consultationSlotLock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expiresAt: new Date("2026-09-05T06:15:00.000Z")
        })
      })
    );
    expect(JSON.stringify(tx.auditLog.create.mock.calls)).not.toContain(
      "transactionReference"
    );
  });

  it("rejects evidence transferred more than 24 hours before intake", async () => {
    const tx = intakeTxMock();

    await expect(
      createManualAppointmentPaymentIntake(
        tx as never,
        {
          actorId: "admin-1",
          availabilityId: "availability-1",
          doctorId: "doctor-1",
          evidence: preparedEvidence(),
          patientId: "patient-1",
          reasonCode: "provider_unavailable",
          scheduledAt: new Date("2026-09-07T02:00:00.000Z"),
          transferredAt: new Date("2026-09-04T05:59:59.000Z")
        },
        now
      )
    ).rejects.toBeInstanceOf(ManualAppointmentIntakeError);
    expect(tx.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns the matching pending intake instead of creating duplicate records", async () => {
    const tx = intakeTxMock();
    tx.consultation.findFirst.mockResolvedValueOnce({
      id: "consultation-existing",
      patientId: "patient-1",
      status: "pending_payment",
      payment: {
        id: "payment-existing",
        status: "pending_review",
        verificationPayload: manualAppointmentPayload()
      }
    });

    const result = await createManualAppointmentPaymentIntake(
      tx as never,
      {
        actorId: "admin-1",
        availabilityId: "availability-1",
        doctorId: "doctor-1",
        evidence: preparedEvidence(),
        patientId: "patient-1",
        reasonCode: "provider_unavailable",
        scheduledAt: new Date("2026-09-07T02:00:00.000Z"),
        transferredAt: new Date("2026-09-05T04:30:00.000Z")
      },
      now
    );

    expect(result).toEqual({
      consultationId: "consultation-existing",
      paymentId: "payment-existing",
      status: "already_pending"
    });
    expect(tx.consultationSlotLock.create).not.toHaveBeenCalled();
    expect(tx.consultation.create).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it("verifies an eligible manual appointment without fabricating provider failure", async () => {
    const tx = txMock({ verificationPayload: manualAppointmentPayload() });

    const result = await applyManualAppointmentPaymentDecision(
      tx as never,
      {
        actorId: "admin-1",
        decision: "verified",
        paymentId: "payment-1",
        transactionReference: "bank-reference-1"
      },
      now
    );

    expect(result).toBe("scheduled");
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "verified",
          normalizedTransactionReference: "BANKREFERENCE1"
        })
      })
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "consultation.manual_appointment_payment_review",
          metadataJson: expect.objectContaining({
            verificationSource: "admin_manual_appointment",
            transactionReferenceRecorded: true
          })
        })
      })
    );
    expect(JSON.stringify(tx.auditLog.create.mock.calls)).not.toContain(
      "BANKREFERENCE1"
    );
  });

  it("keeps verified funds and requires rescheduling when the Admin-created slot expired", async () => {
    const tx = txMock({
      expiresAt: new Date("2026-09-05T05:59:59.000Z"),
      verificationPayload: manualAppointmentPayload()
    });

    const result = await applyManualAppointmentPaymentDecision(
      tx as never,
      {
        actorId: "admin-1",
        decision: "verified",
        paymentId: "payment-1",
        transactionReference: "bank-reference-1"
      },
      now
    );

    expect(result).toBe("reschedule_required");
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "verified" }) })
    );
    expect(tx.consultation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "reschedule_required", slotLockId: null }
      })
    );
  });

  it("rejects the payment, cancels the provisional consultation, and releases the slot", async () => {
    const tx = txMock({ verificationPayload: manualAppointmentPayload() });

    const result = await applyManualAppointmentPaymentDecision(
      tx as never,
      {
        actorId: "admin-1",
        decision: "rejected",
        paymentId: "payment-1",
        rejectionReasonCode: "evidence_invalid"
      },
      now
    );

    expect(result).toBe("rejected");
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "rejected",
          normalizedTransactionReference: null,
          reviewedById: "admin-1"
        })
      })
    );
    expect(tx.consultation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "cancelled", slotLockId: null }
      })
    );
    expect(tx.consultationSlotLock.deleteMany).toHaveBeenCalledWith({
      where: { id: "lock-1" }
    });
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
  });
});
