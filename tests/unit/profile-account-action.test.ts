import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentSession: vi.fn(),
  assertPermission: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));
vi.mock("@/lib/permissions", () => ({ assertPermission: mocks.assertPermission }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/audit/audit-log", () => ({ writeAuditLog: mocks.writeAuditLog }));

import { updateProfileContactAction } from "@/features/profile/actions";

function profileForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("fullName", overrides.fullName ?? "ผู้ป่วย ทดสอบ");
  formData.set("dateOfBirth", overrides.dateOfBirth ?? "1990-01-02");
  formData.set("email", overrides.email ?? "patient@example.com");
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

function transactionUser(overrides: Record<string, unknown> = {}) {
  const tx = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        role: "customer",
        status: "active",
        fullName: "ชื่อเดิม",
        dateOfBirth: new Date("1985-05-06T00:00:00.000Z"),
        email: "old@example.com",
        ...overrides
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    auditLog: { create: vi.fn() }
  };
  mocks.transaction.mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => callback(tx));
  return tx;
}

describe("customer profile account action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({
      userId: "customer-1",
      role: "customer",
      permissions: ["profile:update:self"]
    });
  });

  it("updates only canonical name, DOB, and email with PII-free audit metadata", async () => {
    const tx = transactionUser();

    await expect(
      updateProfileContactAction(
        { status: "idle", message: "" },
        profileForm({ phone: "0899999999", nationalId: "9999999999999" })
      )
    ).resolves.toEqual({ status: "success", message: "บันทึกข้อมูลบัญชีแล้ว" });

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: "customer-1", role: "customer", status: "active" },
      data: {
        fullName: "ผู้ป่วย ทดสอบ",
        dateOfBirth: new Date("1990-01-02T00:00:00.000Z"),
        email: "patient@example.com"
      }
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(tx, {
      actorId: "customer-1",
      action: "profile.identity.update",
      entityType: "user",
      entityId: "customer-1",
      metadata: { changedFields: ["fullName", "dateOfBirth", "email"] }
    });
    const auditInput = JSON.stringify(mocks.writeAuditLog.mock.calls[0]?.[1]);
    expect(auditInput).not.toContain("ผู้ป่วย ทดสอบ");
    expect(auditInput).not.toContain("1990-01-02");
    expect(auditInput).not.toContain("patient@example.com");
    expect(JSON.stringify(tx.user.updateMany.mock.calls[0]?.[0]?.data)).not.toMatch(/phone|nationalId|verified/i);
  });

  it("keeps an email-only change out of identity freshness auditing", async () => {
    const tx = transactionUser({
      fullName: "ผู้ป่วย ทดสอบ",
      dateOfBirth: new Date("1990-01-02T00:00:00.000Z")
    });

    await updateProfileContactAction(
      { status: "idle", message: "" },
      profileForm({ email: "new@example.com" })
    );

    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: "profile.contact.update",
        metadata: { changedFields: ["email"] }
      })
    );
  });

  it.each([
    { role: "doctor", status: "active" },
    { role: "customer", status: "suspended" }
  ])("rejects a stale session unless the database user is an active Customer", async (user) => {
    const tx = transactionUser(user);

    await expect(
      updateProfileContactAction({ status: "idle", message: "" }, profileForm())
    ).resolves.toEqual({ status: "error", message: "ยังบันทึกข้อมูลไม่ได้ กรุณาลองใหม่อีกครั้ง" });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("rejects an impossible DOB before opening a transaction", async () => {
    await expect(
      updateProfileContactAction(
        { status: "idle", message: "" },
        profileForm({ dateOfBirth: "1990-02-30" })
      )
    ).resolves.toMatchObject({ status: "error" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
