import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  doctorFindMany: vi.fn(),
  availabilityFindMany: vi.fn(),
  overrideFindMany: vi.fn(),
  consultationFindMany: vi.fn(),
  userFindMany: vi.fn()
}));

vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    doctor: { findMany: mocks.doctorFindMany },
    doctorAvailability: { findMany: mocks.availabilityFindMany },
    doctorAvailabilityDateOverride: { findMany: mocks.overrideFindMany },
    consultation: { findMany: mocks.consultationFindMany },
    user: { findMany: mocks.userFindMany }
  }
}));

import { getAdminSchedules } from "@/features/admin/schedules/queries";

describe("Admin manual appointment patient filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.doctorFindMany.mockResolvedValue([]);
    mocks.availabilityFindMany.mockResolvedValue([]);
    mocks.overrideFindMany.mockResolvedValue([]);
    mocks.consultationFindMany.mockResolvedValue([]);
    mocks.userFindMany.mockResolvedValue([]);
  });

  it("offers only active customers with the complete verified identity set including national ID", async () => {
    mocks.userFindMany.mockResolvedValueOnce([
      { id: "patient-valid", fullName: "Valid Patient", nationalId: "1101700203450" },
      { id: "patient-invalid", fullName: "Invalid Patient", nationalId: "123" }
    ]);

    const data = await getAdminSchedules({ date: "2030-01-01" });

    expect(mocks.userFindMany).toHaveBeenCalledWith({
      where: {
        role: "customer",
        status: "active",
        fullName: { not: null },
        nationalId: { not: null },
        dateOfBirth: { not: null },
        phone: { not: null },
        normalizedPhone: { not: null },
        phoneVerifiedAt: { not: null }
      },
      orderBy: { fullName: "asc" },
      take: 100,
      select: { id: true, fullName: true, nationalId: true }
    });
    expect(data.manualAppointmentPatients).toEqual([
      { id: "patient-valid", name: "Valid Patient" }
    ]);
  });

  it.each([
    [
      "manual intake",
      { manualAppointmentIntake: { version: 1, source: "admin_manual_appointment" } },
      "รอตรวจรายการโอน",
      true
    ],
    [
      "ordinary customer booking",
      { source: "customer_checkout_foundation" },
      "รอชำระเงิน",
      false
    ]
  ] as const)("maps a %s hold without changing the ordinary pending-payment label", async (_case, verificationPayload, expectedLabel, expectedManual) => {
    const doctor = {
      id: "doctor-1",
      consultationFee: 500,
      specialty: "เวชศาสตร์ครอบครัว",
      status: "approved",
      updatedAt: new Date("2030-01-01T00:00:00.000Z"),
      user: { displayName: "พญ. แพทย์จริง", lineUserId: "line-doctor-1", status: "active" }
    };
    const availability = {
      id: "availability-1",
      doctorId: "doctor-1",
      weekday: 1,
      startTime: "09:00",
      endTime: "09:15",
      slotMinutes: 15,
      effectiveFrom: null,
      effectiveTo: null,
      notes: null
    };
    mocks.doctorFindMany.mockResolvedValueOnce([doctor]);
    mocks.availabilityFindMany
      .mockResolvedValueOnce([{ ...availability, isActive: true, doctor }])
      .mockResolvedValueOnce([availability]);
    mocks.consultationFindMany.mockResolvedValueOnce([{
      doctorId: "doctor-1",
      scheduledAt: new Date("2030-01-07T02:00:00.000Z"),
      bookedDurationMinutes: 15,
      status: "pending_payment",
      payment: { status: "pending_review", verificationPayload },
      slotLock: { expiresAt: new Date("2030-01-07T02:15:00.000Z") }
    }]);

    const data = await getAdminSchedules({
      date: "2030-01-07",
      doctorId: "doctor-1",
      view: "day"
    });

    expect(data.appointmentCalendar.days[0]?.slots[0]).toMatchObject({
      status: "pending_payment",
      statusLabel: expectedLabel,
      manualAppointmentReviewPending: expectedManual
    });
    expect(mocks.consultationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          payment: { select: { status: true, verificationPayload: true } }
        })
      })
    );
  });
});
