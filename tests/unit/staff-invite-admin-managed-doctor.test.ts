import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  revalidatePath: vi.fn(),
  submitStaffInviteRequest: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/features/staff-invite/service", () => ({
  submitStaffInviteRequest: mocks.submitStaffInviteRequest
}));

import { POST } from "@/app/api/staff-invite/route";

function request(fields: Record<string, string>) {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => formData.set(key, value));
  return new Request("http://localhost/api/staff-invite", { method: "POST", body: formData });
}

describe("staff invite role boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue({ userId: "line-user-1", role: "customer" });
    mocks.submitStaffInviteRequest.mockResolvedValue(undefined);
  });

  it("rejects doctor self-service with the general Admin-managed explanation", async () => {
    const response = await POST(request({ role: "doctor" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: expect.stringContaining("ผู้ดูแลระบบ")
    });
    expect(mocks.submitStaffInviteRequest).not.toHaveBeenCalled();
  });

  it("keeps the pharmacist invite flow available", async () => {
    const response = await POST(
      request({
        role: "pharmacist",
        firstName: "เภสัชกร",
        lastName: "ทดสอบ",
        licenseNumber: "PHARM-1",
        pharmacyName: "ร้านยาทดสอบ"
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.submitStaffInviteRequest).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "line-user-1", data: expect.objectContaining({ role: "pharmacist" }) })
    );
  });

  it("keeps the Admin invite flow available", async () => {
    const response = await POST(request({ role: "admin" }));
    expect(response.status).toBe(200);
    expect(mocks.submitStaffInviteRequest).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "line-user-1", data: expect.objectContaining({ role: "admin" }) })
    );
  });
});
