import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertPermission: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
  },
  redirect: vi.fn(() => {
    throw new Error("redirected");
  }),
  revalidatePath: vi.fn(),
  releaseExpiredConsultationSlotLocks: vi.fn(),
  requireCurrentSession: vi.fn(),
}));

vi.mock("@/features/consultations/booking/lock-release", () => ({
  releaseExpiredConsultationSlotLocks: mocks.releaseExpiredConsultationSlotLocks,
}));
vi.mock("@/lib/auth/session", () => ({
  requireCurrentSession: mocks.requireCurrentSession,
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/permissions", () => ({ assertPermission: mocks.assertPermission }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const { createConsultationBookingAction } = await import(
  "@/features/consultations/booking/actions"
);

describe("createConsultationBookingAction booked-duration audit", () => {
  it("persists the DoctorAvailability slotMinutes in consultation.book_slot within the booking transaction", async () => {
    const tx = {
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      consultAssessment: { findFirst: vi.fn().mockResolvedValue(null) },
      consultation: {
        create: vi.fn().mockResolvedValue({ id: "consultation-1" }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      consultationSlotLock: {
        create: vi.fn().mockResolvedValue({ id: "slot-lock-1" }),
      },
      doctorAvailability: {
        findUnique: vi.fn().mockResolvedValue({
          doctor: {
            consultationFee: 800,
            id: "doctor-1",
            status: "approved",
          },
          doctorId: "doctor-1",
          endTime: "10:00",
          id: "availability-1",
          isActive: true,
          slotMinutes: 60,
          startTime: "09:00",
          weekday: 1,
        }),
      },
      notification: { create: vi.fn().mockResolvedValue({}) },
    };

    mocks.requireCurrentSession.mockResolvedValue({
      userId: "patient-1",
    });
    mocks.assertPermission.mockReturnValue(undefined);
    mocks.releaseExpiredConsultationSlotLocks.mockResolvedValue(undefined);
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const formData = new FormData();
    formData.set("availabilityId", "availability-1");

    await expect(createConsultationBookingAction(formData)).rejects.toThrow(
      "redirected",
    );

    expect(tx.consultation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookedDurationMinutes: 60,
        doctorId: "doctor-1",
        slotLockId: "slot-lock-1",
      }),
      select: { id: true },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "consultation.book_slot",
        entityId: "consultation-1",
        entityType: "consultation",
        metadataJson: expect.objectContaining({
          availabilityId: "availability-1",
          slotLockId: "slot-lock-1",
          slotMinutes: 60,
        }),
      }),
    });
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
