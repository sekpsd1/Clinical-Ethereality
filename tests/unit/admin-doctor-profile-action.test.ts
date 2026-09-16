import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireActiveAdminSession: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/guards", () => ({
  requireActiveAdminSession: mocks.requireActiveAdminSession
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: mocks.transaction }
}));

import { manageDoctorProfileAction } from "@/features/admin/users/doctor-profile-actions";

function formData() {
  const data = new FormData();
  data.set("userId", "doctor-user-1");
  data.set("intent", "approve");
  data.set("fullName", "แพทย์ ทดสอบ");
  data.set("specialty", "เวชศาสตร์ครอบครัว");
  data.set("licenseNumber", "MED-1001");
  data.set("bio", "");
  return data;
}

describe("manageDoctorProfileAction concurrency errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActiveAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
  });

  it("maps a database unique race to a specific license error", async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test"
      })
    );

    await expect(manageDoctorProfileAction({ status: "idle", message: "" }, formData())).resolves.toEqual({
      status: "error",
      message: "เลขที่ใบประกอบวิชาชีพนี้ถูกใช้กับแพทย์รายอื่นแล้ว"
    });
  });

  it("fails safely when a concurrent serializable transaction wins", async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("write conflict", {
        code: "P2034",
        clientVersion: "test"
      })
    );

    const result = await manageDoctorProfileAction({ status: "idle", message: "" }, formData());
    expect(result.status).toBe("error");
    expect(result.message).toContain("กำลังเปลี่ยนข้อมูล");
  });
});
