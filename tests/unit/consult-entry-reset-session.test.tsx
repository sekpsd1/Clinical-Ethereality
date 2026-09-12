import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  getCurrentSession: vi.fn(),
  getData: vi.fn(),
  redirect: vi.fn()
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findFirst: mocks.findFirst } } }));
vi.mock("@/features/consultations/doctor-list/queries", () => ({
  getConsultDoctorListData: mocks.getData
}));
vi.mock("@/features/consultations/ConsultDoctorList", () => ({
  ConsultDoctorList: () => null
}));

import ConsultPage from "@/app/(app)/consult/page";

describe("Consult entry after a UAT account reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue({
      userId: "customer-old",
      lineUserId: "line-test-1",
      role: "customer"
    });
    mocks.redirect.mockImplementation((href: string) => {
      throw new Error(`REDIRECT:${href}`);
    });
    mocks.getData.mockResolvedValue({ doctors: [] });
  });

  it("sends a stale access token through LINE login when its User was deleted", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(ConsultPage()).rejects.toThrow("REDIRECT:/auth/line?next=%2Fconsult");
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        id: "customer-old",
        lineUserId: "line-test-1",
        role: "customer",
        status: "active"
      },
      select: { id: true }
    });
    expect(mocks.getData).not.toHaveBeenCalled();
  });

  it("loads Consult normally while the access identity still has an active customer row", async () => {
    mocks.findFirst.mockResolvedValue({ id: "customer-old" });

    await expect(ConsultPage()).resolves.toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.getData).toHaveBeenCalledOnce();
  });
});
