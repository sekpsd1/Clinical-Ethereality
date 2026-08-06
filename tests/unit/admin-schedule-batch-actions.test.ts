import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  revalidatePath: vi.fn(),
  writeAuditLog: vi.fn(),
  transaction: vi.fn(),
  doctorFindUnique: vi.fn(),
  availabilityFindMany: vi.fn(),
  availabilityCreate: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdminSession: mocks.requireAdminSession
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog
}));

import { createDoctorAvailabilityBatchAction } from "@/features/admin/schedules/actions";

function batchFormData() {
  const formData = new FormData();
  formData.set("doctorId", "doctor-1");
  formData.append("weekdays", "1");
  formData.append("weekdays", "3");
  formData.set(
    "blocksJson",
    JSON.stringify([
      { startTime: "09:00", endTime: "11:00", slotMinutes: 60 },
      { startTime: "11:00", endTime: "11:30", slotMinutes: 30 }
    ])
  );
  formData.set("isActive", "on");
  formData.set("notes", "ติดตามอาการ");
  return formData;
}

describe("admin bulk schedule action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mocks.doctorFindUnique.mockResolvedValue({ id: "doctor-1", status: "approved" });
    mocks.availabilityFindMany.mockResolvedValue([]);
    mocks.availabilityCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: `availability-${mocks.availabilityCreate.mock.calls.length}`,
      ...data
    }));
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) =>
      callback({
        doctor: { findUnique: mocks.doctorFindUnique },
        doctorAvailability: {
          findMany: mocks.availabilityFindMany,
          create: mocks.availabilityCreate
        }
      })
    );
  });

  it("creates every block for every selected day in one serializable transaction and writes audits", async () => {
    const result = await createDoctorAvailabilityBatchAction({ status: "idle", message: "" }, batchFormData());

    expect(result).toMatchObject({ status: "success" });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
    expect(mocks.availabilityCreate).toHaveBeenCalledTimes(4);
    expect(mocks.availabilityCreate.mock.calls.map((call) => call[0].data)).toEqual([
      expect.objectContaining({ weekday: 1, startTime: "09:00", endTime: "11:00", slotMinutes: 60 }),
      expect.objectContaining({ weekday: 1, startTime: "11:00", endTime: "11:30", slotMinutes: 30 }),
      expect.objectContaining({ weekday: 3, startTime: "09:00", endTime: "11:00", slotMinutes: 60 }),
      expect.objectContaining({ weekday: 3, startTime: "11:00", endTime: "11:30", slotMinutes: 30 })
    ]);
    expect(mocks.writeAuditLog).toHaveBeenCalledTimes(4);
  });

  it("rejects duplicate or overlapping saved availability before creating any record", async () => {
    mocks.availabilityFindMany.mockResolvedValue([
      { weekday: 1, startTime: "10:30", endTime: "12:00", slotMinutes: 30 }
    ]);

    const result = await createDoctorAvailabilityBatchAction({ status: "idle", message: "" }, batchFormData());

    expect(result).toEqual({ status: "error", message: "ช่วงเวลาที่เลือกซ้อนกับตารางแพทย์เดิม" });
    expect(mocks.availabilityCreate).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("keeps the all-or-nothing transaction error path when one insert fails", async () => {
    mocks.availabilityCreate
      .mockResolvedValueOnce({ id: "availability-1", doctorId: "doctor-1", weekday: 1, startTime: "09:00", endTime: "11:00", slotMinutes: 60, isActive: true })
      .mockRejectedValueOnce(new Error("database write failed"));

    const result = await createDoctorAvailabilityBatchAction({ status: "idle", message: "" }, batchFormData());

    expect(result).toEqual({
      status: "error",
      message: "ไม่สามารถบันทึกตารางหลายวันได้ รายการทั้งหมดจึงไม่ถูกเปลี่ยนแปลง"
    });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("requires an admin session before processing the batch", async () => {
    mocks.requireAdminSession.mockRejectedValueOnce(new Error("admin required"));

    await expect(createDoctorAvailabilityBatchAction({ status: "idle", message: "" }, batchFormData())).rejects.toThrow("admin required");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
