import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), assessment: vi.fn(), profile: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: m.session }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findFirst: m.user }, consultAssessment: { findFirst: m.assessment } } }));
vi.mock("@/features/consultations/doctor-profile/queries", () => ({ getCustomerDoctorProfile: m.profile }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); }, notFound: () => { throw new Error("not-found"); } }));
import Page from "@/app/(app)/consult/doctors/[doctorId]/page";
const input = { params: Promise.resolve({ doctorId: "cm000000000000000000000001" }) };
describe("doctor profile route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.session.mockResolvedValue({ userId: "customer", lineUserId: "line", role: "customer" });
    m.user.mockResolvedValue({ id: "customer" });
    m.profile.mockResolvedValue({ id: "cm000000000000000000000001" });
    m.assessment.mockResolvedValue(null);
  });
  it("requires login before any database lookup", async () => {
    m.session.mockResolvedValue(null);
    await expect(Page(input)).rejects.toThrow("redirect:/auth/line");
    expect(m.user).not.toHaveBeenCalled();
    expect(m.profile).not.toHaveBeenCalled();
  });
  it("rejects non-customer sessions", async () => {
    m.session.mockResolvedValue({ role: "admin" });
    await expect(Page(input)).rejects.toThrow("redirect:");
    expect(m.profile).not.toHaveBeenCalled();
  });
  it("checks active persisted customer with matching LINE identity", async () => {
    m.user.mockResolvedValue(null);
    await expect(Page(input)).rejects.toThrow("redirect:/auth/line");
    expect(m.user).toHaveBeenCalledWith({ where: { id: "customer", lineUserId: "line", role: "customer", status: "active" }, select: { id: true } });
    expect(m.profile).not.toHaveBeenCalled();
  });
  it("returns not found for unavailable doctor", async () => {
    m.profile.mockResolvedValue(null);
    await expect(Page(input)).rejects.toThrow("not-found");
  });
  it("keeps assessment gate when no valid assessment exists", async () => {
    const result = await Page(input);
    expect(result.props.bookingHref).toContain("/consult/assessment?doctorId=");
  });
  it("allows existing booking path only with active assessment", async () => {
    m.assessment.mockResolvedValue({ id: "active-assessment" });
    const result = await Page(input);
    expect(result.props.bookingHref).toContain("/consult/booking/somchai?doctorId=");
  });
});
