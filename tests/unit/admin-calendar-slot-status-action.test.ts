import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: { $transaction: vi.fn() },
  requireAdminSession: vi.fn(),
  revalidatePath: vi.fn(),
  writeAuditLog: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth/guards", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/audit/audit-log", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const { setDoctorCalendarSlotStatusAction } = await import("@/features/admin/schedules/actions");

function transactionClient(activeOverrides: Array<{ id: string; type: "available" | "blocked" | "closed"; startTime: string | null; endTime: string | null; slotMinutes: number | null }> = []) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "doctor-1" }]),
    doctor: { findUnique: vi.fn().mockResolvedValue({ id: "doctor-1", status: "approved", user: { status: "active" } }) },
    doctorAvailability: { findMany: vi.fn().mockResolvedValue([{ id: "weekly-1", startTime: "09:00", endTime: "10:00", slotMinutes: 30, effectiveFrom: null, effectiveTo: null }]) },
    doctorAvailabilityDateOverride: {
      findMany: vi.fn().mockResolvedValue(activeOverrides),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: "created-1" })
    },
    consultation: { findMany: vi.fn().mockResolvedValue([]) },
    consultationSlotLock: { findMany: vi.fn().mockResolvedValue([]) }
  };
}

function statusForm(targetStatus: "available" | "blocked" | "closed") {
  const form = new FormData();
  form.set("doctorId", "doctor-1");
  form.set("scheduleDate", "2099-09-07");
  form.set("startTime", "09:00");
  form.set("endTime", "09:30");
  form.set("slotMinutes", "30");
  form.set("targetStatus", targetStatus);
  return form;
}

describe("admin calendar slot status action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ userId: "admin-1" });
  });

  it("creates an intentional blocked override without rejecting overlapping weekly availability", async () => {
    const tx = transactionClient();
    mocks.prisma.$transaction.mockImplementationOnce(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    await expect(setDoctorCalendarSlotStatusAction({ status: "idle", message: "" }, statusForm("blocked"))).resolves.toMatchObject({ status: "success" });

    expect(tx.doctorAvailabilityDateOverride.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: "blocked", startTime: "09:00", endTime: "09:30" }) });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(tx, expect.objectContaining({ action: "doctor_availability_date_override.calendar_status", metadata: expect.objectContaining({ targetStatus: "blocked" }) }));
  });

  it("refuses a block that overlaps an active appointment", async () => {
    const tx = transactionClient();
    tx.consultation.findMany.mockResolvedValueOnce([{ scheduledAt: new Date("2099-09-07T02:00:00.000Z"), bookedDurationMinutes: 30 }]);
    mocks.prisma.$transaction.mockImplementationOnce(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    await expect(setDoctorCalendarSlotStatusAction({ status: "idle", message: "" }, statusForm("blocked"))).resolves.toMatchObject({ status: "error" });
    expect(tx.doctorAvailabilityDateOverride.create).not.toHaveBeenCalled();
  });

  it("keeps an actual appointment authoritative even when a crafted request asks for available", async () => {
    const tx = transactionClient();
    tx.consultation.findMany.mockResolvedValueOnce([{ scheduledAt: new Date("2099-09-07T02:00:00.000Z"), bookedDurationMinutes: 30 }]);
    mocks.prisma.$transaction.mockImplementationOnce(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    await expect(setDoctorCalendarSlotStatusAction({ status: "idle", message: "" }, statusForm("available"))).resolves.toMatchObject({ status: "error", message: expect.stringContaining("นัดหมาย") });
    expect(tx.doctorAvailabilityDateOverride.updateMany).not.toHaveBeenCalled();
    expect(tx.doctorAvailabilityDateOverride.create).not.toHaveBeenCalled();
  });

  it("returns a blocked cell to available by disabling the block and reusing weekly availability", async () => {
    const tx = transactionClient([{ id: "blocked-1", type: "blocked", startTime: "09:00", endTime: "09:30", slotMinutes: 30 }]);
    mocks.prisma.$transaction.mockImplementationOnce(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    await expect(setDoctorCalendarSlotStatusAction({ status: "idle", message: "" }, statusForm("available"))).resolves.toMatchObject({ status: "success" });

    expect(tx.doctorAvailabilityDateOverride.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["blocked-1"] } }, data: { isActive: false } });
    expect(tx.doctorAvailabilityDateOverride.create).not.toHaveBeenCalled();
  });

  it("turns a closed cell into a date-specific available override when no opening covers it", async () => {
    const tx = transactionClient([{ id: "closed-1", type: "closed", startTime: null, endTime: null, slotMinutes: null }]);
    tx.doctorAvailability.findMany.mockResolvedValueOnce([]);
    mocks.prisma.$transaction.mockImplementationOnce(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    await expect(setDoctorCalendarSlotStatusAction({ status: "idle", message: "" }, statusForm("available"))).resolves.toMatchObject({ status: "success" });

    expect(tx.doctorAvailabilityDateOverride.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["closed-1"] } }, data: { isActive: false } });
    expect(tx.doctorAvailabilityDateOverride.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: "available", startTime: "09:00", endTime: "09:30" }) });
  });

  it("labels the dash choice as a full-date closure and refuses it while a slot lock exists", async () => {
    const tx = transactionClient();
    tx.consultationSlotLock.findMany.mockResolvedValueOnce([{ scheduledAt: new Date("2099-09-07T02:00:00.000Z"), availabilityId: "weekly-1", consultation: null }]);
    tx.doctorAvailability.findMany.mockResolvedValueOnce([{ id: "weekly-1", slotMinutes: 30 }]);
    mocks.prisma.$transaction.mockImplementationOnce(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    await expect(setDoctorCalendarSlotStatusAction({ status: "idle", message: "" }, statusForm("closed"))).resolves.toMatchObject({ status: "error", message: expect.stringContaining("ปิดทั้งวันไม่ได้") });
    expect(tx.doctorAvailabilityDateOverride.create).not.toHaveBeenCalled();
  });
});
