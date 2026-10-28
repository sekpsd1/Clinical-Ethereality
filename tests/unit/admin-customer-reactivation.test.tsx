import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminCustomerDetailData } from "@/features/admin/customers/types";

const mocks = vi.hoisted(() => ({
  requireActiveAdminSession: vi.fn(),
  assertPermission: vi.fn(),
  revalidatePath: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
  files: vi.fn(),
  transaction: vi.fn()
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/guards", () => ({ requireActiveAdminSession: mocks.requireActiveAdminSession, requireAdminSession: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ assertPermission: mocks.assertPermission }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/features/admin/users/staff-files", () => ({ uploadAdminStaffFile: vi.fn() }));
vi.mock("@/features/admin/AdminStaffFileControls", () => ({ AdminStaffFileControls: () => null }));
vi.mock("@/features/admin/AdminCustomerAssessmentResetButton", () => ({ AdminCustomerAssessmentResetButton: () => null }));
vi.mock("@/features/consultations/recordings/ConsultationRecordingsPanel", () => ({ ConsultationRecordingsPanel: () => null }));

import { AdminCustomerDetail } from "@/features/admin/AdminCustomerDetail";
import { updateUserStatusAction } from "@/features/admin/users/actions";

const customer: NonNullable<AdminCustomerDetailData["customer"]> = {
  id: "synthetic-customer", name: "ลูกค้าจำลอง", reference: "TEST", role: "customer",
  email: null, phone: null, accountStatus: "suspended", profilePhotoUrl: null,
  profilePhotoName: null, licenseProofUrl: null, licenseProofName: null,
  createdAt: "28 ต.ค. 2569", lastLoginAt: null, recommendedDoctorName: null,
  assessments: [], consultations: [], orderCount: 0
};

function restoreForm() {
  const form = new FormData();
  form.set("userId", customer.id);
  form.set("status", "active");
  return form;
}

describe("customer reactivation through the existing account controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActiveAdminSession.mockResolvedValue({ userId: "synthetic-admin", role: "admin" });
    mocks.findUnique.mockResolvedValue({ role: "customer", doctorProfile: { status: "archived" } });
    mocks.transaction.mockImplementation(async (callback) => callback({
      user: { findUnique: mocks.findUnique, update: mocks.update },
      fileAttachment: { findMany: mocks.files }, auditLog: { create: mocks.audit }
    }));
  });

  it("renders a named restore action with active status for a suspended customer", async () => {
    const html = renderToStaticMarkup(<AdminCustomerDetail data={{ customer }} currentUserId="synthetic-admin" />);
    expect(html).toContain('aria-label="เปิดใช้งานบัญชี ลูกค้าจำลอง อีกครั้ง"');
    expect(html).toContain('name="status" value="active"');
    expect(html).toContain('value="customer" selected=""');
    if (process.env.CUSTOMER_REACTIVATION_PROOF) {
      const { chromium } = await import("@playwright/test");
      const { readFile } = await import("node:fs/promises");
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        await page.setContent(`<html lang="th"><meta charset="utf-8"><style>${await readFile(`${process.env.CUSTOMER_REACTIVATION_PROOF}.css`, "utf8")}</style><body><main style="padding:16px">${html}</main></body></html>`);
        await page.getByRole("button", { name: "เปิดใช้งานบัญชี ลูกค้าจำลอง อีกครั้ง", exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${process.env.CUSTOMER_REACTIVATION_PROOF}.png` });
      } finally { await browser.close(); }
    }
  });

  it.each(["active", "archived"] as const)("does not offer restoration for a %s customer", (accountStatus) => {
    const html = renderToStaticMarkup(<AdminCustomerDetail data={{ customer: { ...customer, accountStatus } }} currentUserId="synthetic-admin" />);
    expect(html).not.toContain('aria-label="เปิดใช้งานบัญชี');
  });

  it("does not offer account mutations for the current user", () => {
    const html = renderToStaticMarkup(<AdminCustomerDetail data={{ customer }} currentUserId={customer.id} />);
    expect(html).not.toContain('aria-label="เปิดใช้งานบัญชี');
  });

  it("restores only status and audits without requiring an archived former doctor profile", async () => {
    const result = await updateUserStatusAction({ status: "idle", message: "" }, restoreForm());
    expect(result.status).toBe("success");
    expect(mocks.assertPermission).toHaveBeenCalledWith(expect.objectContaining({ role: "admin" }), "admin:access");
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ where: { id: customer.id }, data: { status: "active" } });
    expect(mocks.files).not.toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "user.update_status", entityId: customer.id, metadataJson: { status: "active" } }) });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/customers");
  });

  it("cannot write when the active Admin guard rejects the actor", async () => {
    mocks.requireActiveAdminSession.mockRejectedValue(new Error("unauthorized"));
    await expect(updateUserStatusAction({ status: "idle", message: "" }, restoreForm())).rejects.toThrow("unauthorized");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
