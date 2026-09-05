import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));

const { releaseExpiredConsultationSlotLocks } = await import(
  "@/features/consultations/booking/lock-release"
);
const {
  formatDoctorConsultationDuration,
  resolveDoctorConsultationDurations,
} = await import("@/features/doctor/consultations/duration");

describe("Doctor consultation duration after slot-lock expiry", () => {
  it("clears the consultation lock and deletes it while the queue retains the stored duration", async () => {
    const now = new Date("2026-08-03T03:00:00.000Z");
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "consultation-1" }]),
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      consultation: {
        findMany: vi.fn().mockResolvedValue([
          {
            doctorId: "doctor-1",
            id: "consultation-1",
            patientId: "patient-1",
            scheduledAt: new Date("2026-08-03T02:00:00.000Z"),
            slotLockId: "slot-lock-1",
          },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      consultationSlotLock: {
        deleteMany: vi
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
      notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };

    mocks.prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    await releaseExpiredConsultationSlotLocks(now);

    expect(tx.consultation.updateMany).toHaveBeenCalledWith({
      data: {
        slotLockId: null,
        status: "cancelled",
      },
      where: {
        id: { in: ["consultation-1"] },
        status: "pending_payment",
      },
    });
    expect(tx.consultationSlotLock.deleteMany).toHaveBeenNthCalledWith(1, {
      where: { id: { in: ["slot-lock-1"] } },
    });

    const durations = resolveDoctorConsultationDurations(
      [
        {
          bookedDurationMinutes: 60,
          id: "consultation-1",
        },
      ],
      [],
      [],
    );

    expect(formatDoctorConsultationDuration(durations.get("consultation-1"))).toBe(
      "60 นาที",
    );
  });

  it("recovers the Production legacy duration when no lock remains and availability was not changed after booking", () => {
    const durations = resolveDoctorConsultationDurations(
      [{ bookedDurationMinutes: null, id: "consultation-legacy-1" }],
      [
        {
          createdAt: new Date("2026-08-03T01:00:00.000Z"),
          entityId: "consultation-legacy-1",
          id: "booking-audit-legacy-1",
          metadataJson: { availabilityId: "availability-legacy-1" },
        },
      ],
      [
        {
          id: "availability-legacy-1",
          slotMinutes: 60,
          updatedAt: new Date("2026-08-02T01:00:00.000Z"),
        },
      ],
    );

    expect(
      formatDoctorConsultationDuration(durations.get("consultation-legacy-1")),
    ).toBe("60 นาที");
  });

  it("preserves a provider-failure review while releasing its expired slot", async () => {
    const now = new Date("2026-09-05T06:00:00.000Z");
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "consultation-1" }]),
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      consultation: {
        findMany: vi.fn().mockResolvedValue([
          {
            doctorId: "doctor-1",
            id: "consultation-1",
            patientId: "patient-1",
            scheduledAt: new Date("2026-09-06T02:00:00.000Z"),
            slotLockId: "slot-lock-1",
            payment: {
              status: "pending_review",
              verificationPayload: {
                providerAttempt: {
                  outcome: "provider_error",
                  failedAt: "2026-09-05T05:00:00.000Z"
                }
              }
            }
          }
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      consultationSlotLock: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) }
    };
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)
    );

    await releaseExpiredConsultationSlotLocks(now);

    expect(tx.consultation.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["consultation-1"] },
        status: "pending_payment"
      },
      data: { status: "reschedule_required", slotLockId: null }
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadataJson: expect.objectContaining({
            paymentReviewPreserved: true
          })
        })
      })
    );
  });
});
