import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin/users/actions", () => ({
  approveStaffRoleAction: vi.fn()
}));

import { POST } from "@/app/api/admin/users/approve/route";
import { approveStaffRoleAction } from "@/features/admin/users/actions";

describe("admin staff approval API", () => {
  beforeEach(() => {
    vi.mocked(approveStaffRoleAction).mockReset();
  });

  it("forwards a valid approval request to the existing approval workflow", async () => {
    vi.mocked(approveStaffRoleAction).mockResolvedValue({
      status: "success",
      message: "อนุมัติสิทธิ์เรียบร้อยแล้ว"
    });

    const response = await POST(
      new Request("http://localhost/api/admin/users/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: "user-123",
          role: "doctor"
        })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "อนุมัติสิทธิ์เรียบร้อยแล้ว"
    });
    expect(approveStaffRoleAction).toHaveBeenCalledTimes(1);

    const [, formData] = vi.mocked(approveStaffRoleAction).mock.calls[0];
    expect(formData.get("userId")).toBe("user-123");
    expect(formData.get("role")).toBe("doctor");
  });

  it("rejects invalid approval payloads before running the mutation", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/users/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: "",
          role: "customer"
        })
      })
    );

    expect(response.status).toBe(400);
    expect(approveStaffRoleAction).not.toHaveBeenCalled();
  });
});
