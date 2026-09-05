import { describe, expect, it, vi } from "vitest";
import {
  rescheduleVerifiedConsultation
} from "@/features/consultations/booking/reschedule";

const now = new Date("2026-09-05T06:00:00.000Z");
const scheduledAt = new Date("2026-09-10T02:15:00.000Z");

function txMock() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "consultation-1" }]),
    auditLog: { create: vi.fn() },
    consultation: {
      findUnique: vi.fn().mockResolvedValue({
        id: "consultation-1",
        patientId: "patient-1",
        doctorId: "doctor-1",
        scheduledAt: new Date("2026-09-06T02:00:00.000Z"),
        slotLockId: null,
        status: "reschedule_required",
        payment: { status: "verified" },
        doctor: { userId: "doctor-user-1" }
      }),
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    consultationSlotLock: {
      create: vi.fn().mockResolvedValue({ id: "new-lock-1" })
    },
    doctorAvailability: { findUnique: vi.fn().mockResolvedValue(null) },
    doctorAvailabilityDateOverride: {
      findUnique: vi.fn().mockResolvedValue({
        id: "override-1",
        doctorId: "doctor-1",
        scheduleDate: new Date("2026-09-10T00:00:00.000Z"),
        type: "available",
        startTime: "09:00",
        endTime: "10:00",
        slotMinutes: 15,
        isActive: true,
        doctor: {
          id: "doctor-1",
          status: "approved",
          user: { status: "active" }
        }
      })
    },
    notification: { createMany: vi.fn() }
  };
}

describe("verified consultation rescheduling", () => {
  it("reuses the same doctor and verified payment while creating a permanent slot lock", async () => {
    const tx = txMock();

    await rescheduleVerifiedConsultation(
      tx as never,
      {
        availabilityId: "override-1",
        consultationId: "consultation-1",
        doctorId: "doctor-1",
        patientId: "patient-1",
        scheduledAt
      },
      now
    );

    expect(tx.consultationSlotLock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        doctorId: "doctor-1",
        patientId: "patient-1",
        expiresAt: null
      }),
      select: { id: true }
    });
    expect(tx.consultation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "consultation-1",
        status: "reschedule_required",
        slotLockId: null
      },
      data: {
        bookedDurationMinutes: 15,
        scheduledAt,
        slotLockId: "new-lock-1",
        status: "scheduled"
      }
    });
    expect(tx.notification.createMany).toHaveBeenCalledOnce();
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "consultation.rescheduled_after_manual_payment"
        })
      })
    );
  });

  it("rejects attempts to change to another doctor", async () => {
    const tx = txMock();

    await expect(
      rescheduleVerifiedConsultation(
        tx as never,
        {
          availabilityId: "override-1",
          consultationId: "consultation-1",
          doctorId: "doctor-2",
          patientId: "patient-1",
          scheduledAt
        },
        now
      )
    ).rejects.toMatchObject({
      code: "NOT_ELIGIBLE"
    });
    expect(tx.consultationSlotLock.create).not.toHaveBeenCalled();
  });

  it("fails closed when another consultation already occupies the slot", async () => {
    const tx = txMock();
    tx.consultation.findFirst.mockResolvedValueOnce({ id: "consultation-2" });

    await expect(
      rescheduleVerifiedConsultation(
        tx as never,
        {
          availabilityId: "override-1",
          consultationId: "consultation-1",
          doctorId: "doctor-1",
          patientId: "patient-1",
          scheduledAt
        },
        now
      )
    ).rejects.toMatchObject({
      code: "SLOT_UNAVAILABLE"
    });
  });
});
