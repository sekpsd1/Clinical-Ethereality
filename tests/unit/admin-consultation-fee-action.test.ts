import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  assertPermission: vi.fn(),
  doctorFindUnique: vi.fn(),
  doctorUpdateMany: vi.fn(),
  requireAdminSession: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdminSession: mocks.requireAdminSession
}));

vi.mock("@/lib/permissions", () => ({
  assertPermission: mocks.assertPermission
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog
}));

import { updateConsultationFeeAction } from "@/features/admin/consultation-fees/actions";
import { consultationFeeAmountSchema } from "@/features/admin/consultation-fees/schema";

const currentVersion = new Date("2026-08-27T08:00:00.000Z");

function feeFormData(fee = "1.00", expectedUpdatedAt = currentVersion.toISOString()): FormData {
  const formData = new FormData();
  formData.set("doctorId", "doctor-1");
  formData.set("consultationFee", fee);
  formData.set("expectedUpdatedAt", expectedUpdatedAt);
  return formData;
}

describe("consultation fee amount validation", () => {
  it.each([
    ["1.00", 100],
    ["700.00", 70_000],
    ["100000.00", 10_000_000],
    [" 1.00 ", 100]
  ])("parses %s exactly into integer satang", (input, expectedSatang) => {
    expect(consultationFeeAmountSchema.parse(input)).toBe(expectedSatang);
  });

  it.each([
    "0.00",
    "0.01",
    "1",
    "1.0",
    "1.001",
    "1.50",
    "01.00",
    "1e2",
    "100000.01",
    "100001.00",
    "NaN",
    "Infinity"
  ])("fails closed for invalid or unsupported amount %s", (input) => {
    expect(consultationFeeAmountSchema.safeParse(input).success).toBe(false);
  });
});
describe("updateConsultationFeeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mocks.assertPermission.mockReturnValue(undefined);
    mocks.doctorFindUnique.mockResolvedValue({
      id: "doctor-1",
      consultationFee: 800,
      status: "approved",
      updatedAt: currentVersion,
      user: { status: "active" }
    });
    mocks.doctorUpdateMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        doctor: {
          findUnique: mocks.doctorFindUnique,
          updateMany: mocks.doctorUpdateMany
        }
      })
    );
  });

  it("requires an authorized Admin before validation or database work", async () => {
    mocks.assertPermission.mockImplementationOnce(() => {
      throw new Error("admin access required");
    });

    await expect(updateConsultationFeeAction({ status: "idle", message: "" }, feeFormData())).rejects.toThrow(
      "admin access required"
    );

    expect(mocks.assertPermission).toHaveBeenCalledWith({ userId: "admin-1", role: "admin" }, "admin:access");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects precision bypasses before starting a transaction", async () => {
    const result = await updateConsultationFeeAction({ status: "idle", message: "" }, feeFormData("1.001"));

    expect(result).toMatchObject({ status: "error" });
    expect(result.fieldErrors?.consultationFee).toBeDefined();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("updates only the server-owned fee with CAS and audits old/new satang", async () => {
    const result = await updateConsultationFeeAction({ status: "idle", message: "" }, feeFormData());

    expect(result).toEqual({ status: "success", message: "อัปเดตค่าปรึกษาและบันทึก Audit Log แล้ว" });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
    expect(mocks.doctorFindUnique).toHaveBeenCalledWith({
      where: { id: "doctor-1" },
      select: {
        id: true,
        consultationFee: true,
        status: true,
        updatedAt: true,
        user: { select: { status: true } }
      }
    });
    expect(mocks.doctorUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "doctor-1",
        status: "approved",
        consultationFee: 800,
        updatedAt: currentVersion,
        user: { status: "active" }
      },
      data: { consultationFee: 1 }
    });
    expect(Object.keys(mocks.doctorUpdateMany.mock.calls[0][0].data)).toEqual(["consultationFee"]);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.anything(), {
      actorId: "admin-1",
      action: "doctor.consultation_fee.update",
      entityType: "doctor",
      entityId: "doctor-1",
      metadata: {
        oldAmountSatang: 80_000,
        newAmountSatang: 100
      }
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/consult/booking/somchai");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/consult/payment");
  });

  it("fails closed when the submitted page version is stale", async () => {
    const result = await updateConsultationFeeAction(
      { status: "idle", message: "" },
      feeFormData("1.00", "2026-08-27T07:59:59.000Z")
    );

    expect(result).toEqual({
      status: "error",
      message: "ข้อมูลแพทย์มีการเปลี่ยนแปลง กรุณารีเฟรชหน้าแล้วตรวจสอบค่าล่าสุดก่อนบันทึกอีกครั้ง"
    });
    expect(mocks.doctorUpdateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("fails closed when another writer wins the update CAS", async () => {
    mocks.doctorUpdateMany.mockResolvedValueOnce({ count: 0 });

    const result = await updateConsultationFeeAction({ status: "idle", message: "" }, feeFormData());

    expect(result.status).toBe("error");
    expect(result.message).toContain("ข้อมูลแพทย์มีการเปลี่ยนแปลง");
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("rejects a doctor whose profile or account is not eligible", async () => {
    mocks.doctorFindUnique.mockResolvedValueOnce({
      id: "doctor-1",
      consultationFee: 800,
      status: "approved",
      updatedAt: currentVersion,
      user: { status: "suspended" }
    });

    const result = await updateConsultationFeeAction({ status: "idle", message: "" }, feeFormData());

    expect(result).toEqual({
      status: "error",
      message: "ปรับค่าปรึกษาได้เฉพาะแพทย์ที่อนุมัติแล้วและมีบัญชีใช้งานอยู่"
    });
    expect(mocks.doctorUpdateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("does not write or audit when the server-owned amount is already unchanged", async () => {
    mocks.doctorFindUnique.mockResolvedValueOnce({
      id: "doctor-1",
      consultationFee: 1,
      status: "approved",
      updatedAt: currentVersion,
      user: { status: "active" }
    });

    const result = await updateConsultationFeeAction({ status: "idle", message: "" }, feeFormData());

    expect(result).toEqual({
      status: "success",
      message: "ค่าปรึกษาเป็นจำนวนนี้อยู่แล้ว จึงไม่มีการเปลี่ยนแปลง"
    });
    expect(mocks.doctorUpdateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });
});
