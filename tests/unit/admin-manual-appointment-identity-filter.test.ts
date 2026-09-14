import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  doctorFindMany: vi.fn(),
  availabilityFindMany: vi.fn(),
  overrideFindMany: vi.fn(),
  userFindMany: vi.fn()
}));

vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    doctor: { findMany: mocks.doctorFindMany },
    doctorAvailability: { findMany: mocks.availabilityFindMany },
    doctorAvailabilityDateOverride: { findMany: mocks.overrideFindMany },
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
});
