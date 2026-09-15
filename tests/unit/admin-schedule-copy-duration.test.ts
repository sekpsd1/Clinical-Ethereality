import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn().mockResolvedValue({ userId: "admin-1", role: "admin" }),
  revalidatePath: vi.fn(),
  writeAuditLog: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/guards", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/audit/audit-log", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { copyDoctorAvailabilityDateOverridesAction } from "@/features/admin/schedules/actions";

describe("admin schedule copy duration", () => {
  it("copies an old daily opening as a fixed 15-minute schedule", async () => {
    const create = vi.fn().mockImplementation(async ({ data }) => ({ id: "copy-1", ...data }));
    const findMany = vi.fn()
      .mockResolvedValueOnce([
        {
          type: "available",
          startTime: "09:00",
          endTime: "10:00",
          slotMinutes: 60,
          notes: "legacy source"
        }
      ])
      .mockResolvedValueOnce([]);
    const tx = {
      consultation: { findFirst: vi.fn().mockResolvedValue(null) },
      doctor: { findUnique: vi.fn().mockResolvedValue({ id: "doctor-1", status: "approved" }) },
      doctorAvailability: { findMany: vi.fn().mockResolvedValue([]) },
      doctorAvailabilityDateOverride: { create, findMany },
      auditLog: { create: vi.fn() }
    };
    mocks.transaction.mockImplementationOnce(async (callback: (client: typeof tx) => Promise<void>) => callback(tx));

    const formData = new FormData();
    formData.set("doctorId", "doctor-1");
    formData.set("sourceDate", "2030-01-07");
    formData.append("targetDates", "2030-01-08");
    formData.set("confirm", "copy");

    await expect(copyDoctorAvailabilityDateOverridesAction({ status: "idle", message: "" }, formData)).resolves.toMatchObject({ status: "success" });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ slotMinutes: 15 })
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ metadata: expect.objectContaining({ slotMinutes: 15 }) })
    );
  });
});
