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
  requireVerifiedPatientProfile: vi.fn(),
}));

vi.mock("@/features/consultations/booking/lock-release", () => ({
  releaseExpiredConsultationSlotLocks: mocks.releaseExpiredConsultationSlotLocks,
}));
vi.mock("@/lib/auth/session", () => ({
  requireCurrentSession: mocks.requireCurrentSession,
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/permissions", () => ({ assertPermission: mocks.assertPermission }));
vi.mock("@/features/identity-verification/service", () => ({
  PatientVerificationError: class PatientVerificationError extends Error {},
  requireVerifiedPatientProfile: mocks.requireVerifiedPatientProfile,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const { createConsultationBookingAction } = await import(
  "@/features/consultations/booking/actions"
);
const { getUpcomingDateForWeekday } = await import("@/features/consultations/booking/slots");

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
            user: { status: "active" },
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
      user: {
        findUnique: vi.fn().mockResolvedValue({
          fullName: "Patient Example",
          dateOfBirth: new Date("1990-01-30T00:00:00.000Z"),
          phone: "0812345678",
          normalizedPhone: "+66812345678",
          phoneVerifiedAt: new Date("2026-08-13T16:00:00.000Z")
        })
      },
    };

    mocks.requireCurrentSession.mockResolvedValue({
      userId: "patient-1",
    });
    mocks.assertPermission.mockReturnValue(undefined);
    mocks.requireVerifiedPatientProfile.mockResolvedValue(undefined);
    mocks.releaseExpiredConsultationSlotLocks.mockResolvedValue(undefined);
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const formData = new FormData();
    formData.set("availabilityId", "availability-1");
    formData.set("scheduledAt", getUpcomingDateForWeekday(1, "09:00").toISOString());

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

  it("rejects a selected doctor when the submitted availability belongs to another doctor", async () => {
    const selectedDoctorId = "ckz1a2b3c4d5e6f7g8h9i0j1";
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          fullName: "Patient Example",
          dateOfBirth: new Date("1990-01-30T00:00:00.000Z"),
          phone: "0812345678",
          normalizedPhone: "+66812345678",
          phoneVerifiedAt: new Date("2026-08-13T16:00:00.000Z")
        })
      },
      doctorAvailability: {
        findUnique: vi.fn().mockResolvedValue({
          doctor: { id: "doctor-other", status: "approved", user: { status: "active" } },
          doctorId: "doctor-other",
          id: "availability-1",
          isActive: true
        })
      },
      doctorAvailabilityDateOverride: { findUnique: vi.fn() }
    };

    mocks.requireCurrentSession.mockResolvedValue({ userId: "patient-1" });
    mocks.assertPermission.mockReturnValue(undefined);
    mocks.requireVerifiedPatientProfile.mockResolvedValue(undefined);
    mocks.releaseExpiredConsultationSlotLocks.mockResolvedValue(undefined);
    mocks.prisma.$transaction.mockImplementationOnce(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)
    );

    const formData = new FormData();
    formData.set("availabilityId", "availability-1");
    formData.set("scheduledAt", getUpcomingDateForWeekday(1, "09:00").toISOString());
    formData.set("doctorId", selectedDoctorId);

    await expect(createConsultationBookingAction(formData)).rejects.toThrow("redirected");

    expect(mocks.redirect).toHaveBeenLastCalledWith(
      `/consult/booking/somchai?doctorId=${selectedDoctorId}&booking=failed`
    );
  });
});
