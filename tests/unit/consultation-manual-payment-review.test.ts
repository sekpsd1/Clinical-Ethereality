import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  applyManualAppointmentPaymentDecision,
  applyManualConsultationPaymentReview,
  createManualAppointmentPaymentIntake,
  getConsultationProviderFailureAt,
  ManualAppointmentIntakeError,
  recordConsultationProviderFailure
} from "@/features/consultations/payment/manual-review";
import { manualConsultationPaymentReviewSchema } from "@/features/admin/payments/schema";

const now = new Date("2026-09-05T06:00:00.000Z");
const scheduledAt = new Date("2026-09-06T02:00:00.000Z");

function txMock(overrides: {
  consultationStatus?:
    | "pending_payment"
    | "scheduled"
    | "reschedule_required"
    | "cancelled"
    | "completed";
  expiresAt?: Date | null;
  paymentStatus?: "pending_review" | "verified" | "refunded";
  normalizedReference?: string | null;
  verificationPayload?: Prisma.JsonValue;
} = {}) {
  const consultationStatus = overrides.consultationStatus ?? "pending_payment";
  const paymentStatus = overrides.paymentStatus ?? "pending_review";
  return {
    $queryRaw: vi.fn()
      .mockResolvedValue([])
      .mockResolvedValueOnce([{ id: "doctor-1" }])
      .mockResolvedValueOnce([{ id: "consultation-1" }])
      .mockResolvedValueOnce([{ id: "payment-1" }]),
    auditLog: { create: vi.fn() },
    consultation: {
      findUnique: vi.fn().mockResolvedValue({
        id: "consultation-1",
        patientId: "patient-1",
        doctorId: "doctor-1",
        createdAt: new Date("2026-09-05T02:00:00.000Z"),
        scheduledAt,
        bookedDurationMinutes: 30,
        slotLockId: consultationStatus === "reschedule_required" ? null : "lock-1",
        status: consultationStatus,
        patient: {
          role: "customer",
          status: "active",
          fullName: "Verified Patient",
          nationalId: "1101700203450",
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
                attemptId: "attempt-1",
                outcome: "provider_error",
                failedAt: "2026-09-05T04:00:00.000Z",
                provider: "slipok",
                failure: {
                  classification: "provider_unavailable",
                  code: "slipok_1009",
                  retryAfterSeconds: 900,
                  retryGuidance: "independent_bank_confirmation"
                }
              }
            }
        }
      }),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    consultationSlotLock: {
      deleteMany: vi.fn(),
      findMany: vi.fn().mockResolvedValue([])
    },
    doctorAvailability: { findMany: vi.fn().mockResolvedValue([]) },
    doctorAvailabilityDateOverride: { findFirst: vi.fn().mockResolvedValue(null) },
    fileAttachment: {
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue({ id: "attachment-1" })
    },
    notification: { create: vi.fn() },
    payment: {
      findUnique: vi.fn().mockResolvedValue({
        consultationId: "consultation-1",
        consultation: { doctorId: "doctor-1" }
      }),
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        role: "admin",
        status: "active"
      })
    }
  };
}

function input(
  overrides: Partial<
    Parameters<typeof applyManualConsultationPaymentReview>[1]
  > = {}
): Parameters<typeof applyManualConsultationPaymentReview>[1] {
  return {
    actorId: "admin-1",
    amount: "900.00",
    confirmationNote: "ตรวจพบยอดเข้าบัญชีตรงกับรายการ",
    customerReportedAt: new Date("2026-09-05T04:30:00.000Z"),
    evidenceSource: "bank_statement",
    paymentId: "payment-1",
    reasonCode: "provider_unavailable" as const,
    supportingEvidence: {
      attachmentId: "admin-evidence-1",
      byteSize: 128,
      cleanup: vi.fn(),
      fileName: "statement.png",
      mimeType: "image/png",
      storageKey: "payments/admin/statement.png",
      storageUrl: "/api/payments/slips/admin-evidence-1"
    },
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
      attemptId: "attempt-1",
      consultationId: "consultation-1",
      failure: {
        classification: "provider_unavailable",
        code: "slipok_1009",
        retryAfterSeconds: 900,
        retryGuidance: "independent_bank_confirmation"
      },
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
      confirmationNote: "ตรวจพบยอดเข้าบัญชีตรงกับรายการ",
      evidenceSource: "bank_statement",
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
    expect(tx.$queryRaw).toHaveBeenCalledTimes(5);
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
    expect(tx.fileAttachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: "admin-evidence-1",
          ownerId: "admin-1",
          purpose: "other",
          entityType: "consultation_manual_review_evidence",
          entityId: "payment-1",
          storageUrl:
            "/api/admin/payments/evidence/admin-evidence-1",
          metadataJson: expect.objectContaining({
            visibility: "admin_only",
            evidenceSource: "bank_statement"
          })
        })
      })
    );
    const auditJson = JSON.stringify(tx.auditLog.create.mock.calls);
    expect(auditJson).toContain("admin-evidence-1");
    expect(auditJson).not.toContain("ตรวจพบยอดเข้าบัญชีตรงกับรายการ");
    expect(auditJson).not.toContain(
      "/api/admin/payments/evidence/admin-evidence-1"
    );
  });

  it("ignores a late failure from an older provider attempt", async () => {
    const tx = txMock();

    await recordConsultationProviderFailure(tx as never, {
      actorId: "patient-1",
      attemptId: "attempt-old",
      consultationId: "consultation-1",
      failure: {
        classification: "provider_timeout",
        code: "request_timeout",
        retryAfterSeconds: null,
        retryGuidance: "independent_bank_confirmation"
      },
      provider: "slipok"
    });

    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects an inactive or stale Admin session inside the transaction", async () => {
    const tx = txMock();
    tx.user.findUnique.mockResolvedValueOnce({
      role: "admin",
      status: "suspended"
    });

    await expect(
      applyManualConsultationPaymentReview(tx as never, input(), now)
    ).rejects.toMatchObject({ code: "ADMIN_NOT_ACTIVE" });
    expect(tx.fileAttachment.create).not.toHaveBeenCalled();
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
  });

  it("allows immediate review without waiting after the provider failure", async () => {
    const tx = txMock();

    const outcome = await applyManualConsultationPaymentReview(
      tx as never,
      input({
        customerReportedAt: new Date("2026-09-05T04:00:00.000Z")
      }),
      now
    );

    expect(outcome).toBe("scheduled");
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

  it("keeps verified funds but refuses to schedule a slot blocked before manual review", async () => {
    const tx = txMock();
    tx.doctorAvailabilityDateOverride.findFirst.mockResolvedValueOnce({ id: "blocked-1" });

    const outcome = await applyManualConsultationPaymentReview(tx as never, input(), now);

    expect(outcome).toBe("reschedule_required");
    expect(tx.consultation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "reschedule_required", slotLockId: null } }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ metadataJson: expect.objectContaining({ blockedByScheduleOverride: true }) }) }));
  });

  it("keeps verified funds but refuses to schedule a slot occupied before review", async () => {
    const tx = txMock();
    tx.$queryRaw.mockResolvedValueOnce([{
      id: "consultation-other",
      scheduledAt,
      durationMinutes: 30
    }]);

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
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadataJson: expect.objectContaining({
            blockedByOccupiedSlot: true
          })
        })
      })
    );
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
    expect(tx.fileAttachment.create).not.toHaveBeenCalled();
  });

  it("fails closed on a concurrent payment update", async () => {
    const tx = txMock();
    tx.payment.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      applyManualConsultationPaymentReview(tx as never, input(), now)
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(tx.consultation.updateMany).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it("does not override a provider result that won the race", async () => {
    const tx = txMock({
      consultationStatus: "scheduled",
      paymentStatus: "verified",
      normalizedReference: "PROVIDERREFERENCE",
      verificationPayload: {
        source: "slipok",
        result: { status: "verified" }
      }
    });

    await expect(
      applyManualConsultationPaymentReview(tx as never, input(), now)
    ).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    expect(tx.fileAttachment.create).not.toHaveBeenCalled();
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["cancelled", "pending_review"],
    ["completed", "verified"],
    ["scheduled", "refunded"]
  ] as const)(
    "does not override terminal consultation/payment state %s/%s",
    async (consultationStatus, paymentStatus) => {
      const tx = txMock({ consultationStatus, paymentStatus });

      await expect(
        applyManualConsultationPaymentReview(tx as never, input(), now)
      ).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
      expect(tx.fileAttachment.create).not.toHaveBeenCalled();
    }
  );

  it("does not make explicit provider rejection eligible for Admin override", () => {
    expect(
      getConsultationProviderFailureAt({
        providerAttempt: {
          outcome: "rejected",
          failedAt: "2026-09-05T04:00:00.000Z"
        }
      })
    ).toBeNull();
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
    $queryRaw: vi.fn()
      .mockResolvedValue([])
      .mockResolvedValueOnce([{ id: "patient-1" }])
      .mockResolvedValueOnce([{ id: "doctor-1" }]),
    auditLog: { create: vi.fn() },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        role: "customer",
        status: "active",
        fullName: "Verified Patient",
        nationalId: "1101700203450",
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
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "consultation-1" })
    },
    consultationSlotLock: {
      findMany: vi.fn().mockResolvedValue([]),
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
  it("creates only pending records with a 15-minute snapshot from legacy availability", async () => {
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
        scheduledAt: new Date("2026-09-07T02:15:00.000Z"),
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
        data: expect.objectContaining({ bookedDurationMinutes: 15, status: "pending_payment" })
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

  it("rejects a crafted manual intake when the active customer has no national ID", async () => {
    const tx = intakeTxMock();
    tx.user.findUnique.mockResolvedValueOnce({
      role: "customer",
      status: "active",
      fullName: "Verified Patient",
      nationalId: null,
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      phone: "0812345678",
      normalizedPhone: "+66812345678",
      phoneVerifiedAt: new Date("2026-09-01T00:00:00.000Z")
    });

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
          transferredAt: new Date("2026-09-05T05:30:00.000Z")
        },
        now
      )
    ).rejects.toMatchObject({ code: "PATIENT_NOT_VERIFIED" });
    expect(tx.consultation.create).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
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

  it("rejects an Admin manual intake when the selected time is blocked", async () => {
    const tx = intakeTxMock();
    tx.doctorAvailabilityDateOverride.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "blocked-1" });

    await expect(createManualAppointmentPaymentIntake(tx as never, {
      actorId: "admin-1",
      availabilityId: "availability-1",
      doctorId: "doctor-1",
      evidence: preparedEvidence(),
      patientId: "patient-1",
      reasonCode: "provider_unavailable",
      scheduledAt: new Date("2026-09-07T02:00:00.000Z"),
      transferredAt: new Date("2026-09-05T05:30:00.000Z")
    }, now)).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    expect(tx.consultationSlotLock.create).not.toHaveBeenCalled();
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
        confirmationNote: "ตรวจพบยอดเข้าบัญชีตรงกับรายการ",
        decision: "verified",
        evidenceSource: "bank_statement",
        paymentId: "payment-1",
        supportingEvidence: preparedEvidence(),
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
        confirmationNote: "ตรวจพบยอดเข้าบัญชีตรงกับรายการ",
        decision: "verified",
        evidenceSource: "bank_statement",
        paymentId: "payment-1",
        supportingEvidence: preparedEvidence(),
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
