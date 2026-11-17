import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  doctorFindMany: vi.fn(),
  availabilityFindMany: vi.fn(),
  overrideFindMany: vi.fn(),
  consultationFindMany: vi.fn(),
  queryRaw: vi.fn(),
  requireAdminSession: vi.fn(),
  assertPermission: vi.fn()
}));

vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    doctor: { findMany: mocks.doctorFindMany },
    doctorAvailability: { findMany: mocks.availabilityFindMany },
    doctorAvailabilityDateOverride: { findMany: mocks.overrideFindMany },
    consultation: { findMany: mocks.consultationFindMany },
    $queryRaw: mocks.queryRaw
  }
}));

vi.mock("@/lib/auth/guards", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/permissions", () => ({ assertPermission: mocks.assertPermission }));

import { searchManualAppointmentPatients } from "@/features/admin/schedules/manual-patient-search";
import { getAdminSchedules } from "@/features/admin/schedules/queries";

describe("Admin manual appointment patient filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.doctorFindMany.mockResolvedValue([]);
    mocks.availabilityFindMany.mockResolvedValue([]);
    mocks.overrideFindMany.mockResolvedValue([]);
    mocks.consultationFindMany.mockResolvedValue([]);
    mocks.queryRaw.mockResolvedValue([]);
    mocks.requireAdminSession.mockResolvedValue({ userId: "synthetic-admin" });
  });

  it("searches the eligible population by literal Thai name and returns only a bounded list", async () => {
    const patients = Array.from({ length: 21 }, (_, index) => ({ id: String(index), name: "ชื่อทดสอบ" }));
    mocks.queryRaw.mockResolvedValueOnce(patients);
    await expect(searchManualAppointmentPatients("  ชื่อ%  ")).resolves.toEqual({
      patients: patients.slice(0, 20), hasMore: true
    });
    expect(mocks.assertPermission).toHaveBeenCalledWith({ userId: "synthetic-admin" }, "consultation:manual-create");
    const [parts, name, limit] = mocks.queryRaw.mock.calls[0];
    expect(name).toBe("ชื่อ%");
    expect(limit).toBe(21);
    const sql = parts.join("?");
    for (const predicate of [
      "SELECT id, fullName AS name", "role = 'customer'", "status = 'active'",
      "INSTR(fullName, ?) > 0", "nationalId REGEXP", "dateOfBirth IS NOT NULL",
      "phone <> ''", "normalizedPhone <> ''", "phoneVerifiedAt IS NOT NULL"
    ]) expect(sql).toContain(predicate);
  });

  it("does not query for short names or callers denied manual intake permission", async () => {
    await expect(searchManualAppointmentPatients("ก")).resolves.toEqual({ patients: [], hasMore: false });
    mocks.assertPermission.mockImplementationOnce(() => { throw new Error("Forbidden"); });
    await expect(searchManualAppointmentPatients("ชื่อทดสอบ")).rejects.toThrow("Forbidden");
    expect(mocks.queryRaw).not.toHaveBeenCalled();
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
