import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDoctorSession: vi.fn(),
  doctorFindUnique: vi.fn(),
  consultationFindMany: vi.fn(),
  productFindMany: vi.fn()
}));

vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  requireDoctorSession: mocks.requireDoctorSession
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    doctor: { findUnique: mocks.doctorFindUnique },
    consultation: { findMany: mocks.consultationFindMany },
    product: { findMany: mocks.productFindMany }
  }
}));

import { getDoctorConsultations } from "@/features/doctor/consultations/queries";

describe("doctor consultation initial query privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireDoctorSession.mockResolvedValue({ role: "doctor", userId: "doctor-user-1" });
    mocks.doctorFindUnique.mockResolvedValue({ id: "doctor-1" });
    mocks.consultationFindMany.mockResolvedValue([]);
    mocks.productFindMany.mockResolvedValue([]);
  });

  it("does not select identity-reveal fields for the initial queue payload", async () => {
    const data = await getDoctorConsultations();
    const query = mocks.consultationFindMany.mock.calls[0]?.[0];

    expect(query.include.patient).toEqual({
      select: {
        displayName: true,
        lineUserId: true
      }
    });
    expect(query.include.patient.select).not.toHaveProperty("fullName");
    expect(query.include.patient.select).not.toHaveProperty("nationalId");
    expect(query.include.patient.select).not.toHaveProperty("dateOfBirth");
    expect(JSON.stringify(data)).not.toContain("nationalId");
    expect(JSON.stringify(data)).not.toContain("dateOfBirth");
  });
});
