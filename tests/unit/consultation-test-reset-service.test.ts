import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  writeAuditLog: vi.fn()
}));

vi.mock("@/lib/audit/audit-log", () => ({ writeAuditLog: mocks.writeAuditLog }));

import {
  cancelSelectedTestConsultation,
  previewSelectedTestConsultationReset
} from "@/features/admin/consultation-test-reset/service";

const now = new Date("2026-09-05T10:00:00.000Z");
const updatedAt = new Date("2026-09-05T09:00:00.000Z");
const scheduledAt = new Date("2026-09-06T09:00:00.000Z");
const expiresAt = new Date("2026-09-06T08:00:00.000Z");

function sourceAudit() {
  return {
    action: "consultation.zoom_uat_fixture_created",
    metadataJson: {
      controlled: true,
      fixtureKey: "fixture-20260905",
      nonMonetary: true,
      targetFingerprint: "opaque-fingerprint"
    }
  };
}

function target(overrides: Record<string, unknown> = {}) {
  return {
    id: "consultation-1",
    doctorId: "doctor-1",
    patientId: "patient-secret-id",
    scheduledAt,
    slotLockId: "lock-1",
    status: "pending_payment",
    summary: "[UAT] Controlled non-monetary Zoom UAT; key=fixture-20260905",
    updatedAt,
    slotLock: {
      id: "lock-1",
      doctorId: "doctor-1",
      patientId: "patient-secret-id",
      scheduledAt,
      expiresAt
    },
    payment: {
      id: "payment-1",
      status: "pending_review",
      updatedAt,
      verificationPayload: { source: "existing-source", evidence: "preserve-me" }
    },
    ...overrides
  };
}

function transaction(
  targetValue = target(),
  audits: Array<{ action: string; metadataJson: Record<string, unknown> }> = [
    sourceAudit()
  ]
) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "locked" }]),
    consultation: {
      findUnique: vi.fn().mockResolvedValue(targetValue),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    payment: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    consultationSlotLock: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    auditLog: {
      findMany: vi.fn().mockResolvedValue(audits)
    },
    fileAttachment: {
      deleteMany: vi.fn()
    }
  };
}

function asTx(value: ReturnType<typeof transaction>): Prisma.TransactionClient {
  return value as unknown as Prisma.TransactionClient;
}

describe("consultation test reset service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("previews one exact target and returns no patient PII", async () => {
    const tx = transaction();
    const preview = await previewSelectedTestConsultationReset(
      asTx(tx),
      "consultation-1",
      now
    );

    expect(tx.consultation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "consultation-1" } })
    );
    expect(preview).toMatchObject({
      code: "eligible",
      eligible: true,
      target: {
        consultationId: "consultation-1",
        doctorId: "doctor-1",
        status: "pending_payment",
        payment: { id: "payment-1", status: "pending_review" },
        slotLock: { id: "lock-1", owned: true }
      }
    });
    const serialized = JSON.stringify(preview);
    expect(serialized).not.toContain("patient-secret-id");
    expect(serialized).not.toContain("summary");
    expect(serialized).not.toContain("evidence");
  });

  it("cancels with CAS, retains pending payment status/evidence, releases only the owned lock, and audits", async () => {
    const tx = transaction();
    const result = await cancelSelectedTestConsultation(
      asTx(tx),
      {
        actorId: "admin-1",
        consultationId: "consultation-1",
        expectedStatus: "pending_payment",
        expectedUpdatedAt: updatedAt,
        reason: "test_data_reset"
      },
      now
    );

    expect(result).toEqual({
      outcome: "cancelled",
      consultationId: "consultation-1",
      paymentPreserved: true,
      paymentStatus: "pending_review",
      slotReleased: true
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: "payment-1",
        consultationId: "consultation-1",
        status: "pending_review",
        updatedAt
      },
      data: {
        verificationPayload: {
          source: "existing-source",
          evidence: "preserve-me",
          testDataReset: expect.objectContaining({
            kind: "test_data_reset",
            consultationId: "consultation-1",
            paymentId: "payment-1",
            paymentStatusAtReset: "pending_review"
          })
        }
      }
    });
    expect(tx.consultation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "consultation-1",
        status: "pending_payment",
        updatedAt,
        slotLockId: "lock-1"
      },
      data: { status: "cancelled", slotLockId: null }
    });
    expect(tx.consultationSlotLock.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "lock-1",
        doctorId: "doctor-1",
        patientId: "patient-secret-id",
        scheduledAt
      }
    });
    expect(tx.fileAttachment.deleteMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: "admin-1",
        action: "consultation.test_reset_cancel",
        entityType: "consultation",
        entityId: "consultation-1",
        metadata: expect.objectContaining({
          reason: "test_data_reset",
          previousConsultationStatus: "pending_payment",
          nextConsultationStatus: "cancelled",
          paymentStatus: "pending_review",
          paymentPreserved: true,
          slotOutcome: "released"
        })
      })
    );
  });

  it("denies a selected appointment without the controlled UAT audit marker", async () => {
    const tx = transaction(target(), []);

    await expect(
      cancelSelectedTestConsultation(
        asTx(tx),
        {
          actorId: "admin-1",
          consultationId: "consultation-1",
          expectedStatus: "pending_payment",
          expectedUpdatedAt: updatedAt,
          reason: "test_data_reset"
        },
        now
      )
    ).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.consultation.updateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("denies a provenance-valid fixture after it reaches a terminal completed lifecycle", async () => {
    const tx = transaction(target({ status: "completed" }));

    await expect(
      cancelSelectedTestConsultation(
        asTx(tx),
        {
          actorId: "admin-1",
          consultationId: "consultation-1",
          expectedStatus: "completed",
          expectedUpdatedAt: updatedAt,
          reason: "test_data_reset"
        },
        now
      )
    ).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.consultation.updateMany).not.toHaveBeenCalled();
  });

  it("fails closed before writes when an attached lock is not owned by the target", async () => {
    const unsafe = target({
      slotLock: {
        id: "lock-1",
        doctorId: "doctor-other",
        patientId: "patient-secret-id",
        scheduledAt,
        expiresAt
      }
    });
    const tx = transaction(unsafe);

    await expect(
      cancelSelectedTestConsultation(
        asTx(tx),
        {
          actorId: "admin-1",
          consultationId: "consultation-1",
          expectedStatus: "pending_payment",
          expectedUpdatedAt: updatedAt,
          reason: "test_data_reset"
        },
        now
      )
    ).rejects.toMatchObject({ code: "UNSAFE_SLOT_LOCK" });
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.consultationSlotLock.deleteMany).not.toHaveBeenCalled();
  });

  it("detects a payment CAS race and relies on transaction rollback", async () => {
    const tx = transaction();
    tx.payment.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      cancelSelectedTestConsultation(
        asTx(tx),
        {
          actorId: "admin-1",
          consultationId: "consultation-1",
          expectedStatus: "pending_payment",
          expectedUpdatedAt: updatedAt,
          reason: "test_data_reset"
        },
        now
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(tx.consultation.updateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("is idempotent only when cancelled state, strict payment marker, and matching audit all exist", async () => {
    const resetMarker = {
      version: 1,
      kind: "test_data_reset",
      reason: "test_data_reset",
      consultationId: "consultation-1",
      paymentId: "payment-1",
      cancelledAt: now.toISOString(),
      cancelledById: "admin-1",
      previousConsultationStatus: "pending_payment",
      paymentStatusAtReset: "pending_review"
    };
    const resetTarget = target({
      status: "cancelled",
      slotLockId: null,
      slotLock: null,
      payment: {
        id: "payment-1",
        status: "pending_review",
        updatedAt,
        verificationPayload: { testDataReset: resetMarker }
      }
    });
    const tx = transaction(resetTarget, [
      sourceAudit(),
      {
        action: "consultation.test_reset_cancel",
        metadataJson: {
          consultationId: "consultation-1",
          paymentId: "payment-1",
          reason: "test_data_reset",
          cancelledAt: now.toISOString(),
          cancelledById: "admin-1"
        }
      }
    ]);

    const result = await cancelSelectedTestConsultation(
      asTx(tx),
      {
        actorId: "admin-1",
        consultationId: "consultation-1",
        expectedStatus: "pending_payment",
        expectedUpdatedAt: updatedAt,
        reason: "test_data_reset"
      },
      now
    );

    expect(result.outcome).toBe("already_reset");
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.consultation.updateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });
});
