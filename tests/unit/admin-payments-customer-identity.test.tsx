import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  payment: {
    findMany: vi.fn()
  }
}));

vi.mock("next/cache", () => ({
  unstable_noStore: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock
}));

import { AdminPayments } from "@/features/admin/AdminPayments";
import { getAdminPayments } from "@/features/admin/payments/queries";

function createPayment(overrides: { displayName?: string | null; phone?: string | null } = {}) {
  return {
    id: "payment-1",
    orderId: "order-abcdef",
    consultationId: null,
    order: {
      user: {
        displayName: overrides.displayName === undefined ? "  Customer Profile  " : overrides.displayName,
        phone: overrides.phone === undefined ? "  0800000000  " : overrides.phone,
        lineUserId: "U0123456789"
      },
      items: []
    },
    consultation: null,
    reviewedBy: null,
    amount: 1,
    method: "promptpay",
    status: "pending_slip",
    slipImageUrl: null,
    qrPayload: null,
    verificationPayload: null,
    normalizedTransactionReference: null,
    createdAt: new Date("2026-08-13T16:27:00.000Z"),
    reviewedAt: null
  };
}

describe("Admin Payments customer identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the stored profile display name and phone before the secondary LINE ID", async () => {
    prismaMock.payment.findMany.mockResolvedValue([createPayment()]);

    const data = await getAdminPayments();

    expect(data.payments[0]).toMatchObject({
      customerName: "Customer Profile",
      customerPhone: "0800000000",
      customerLineId: "U0123456789"
    });

    const html = renderToStaticMarkup(<AdminPayments data={data} />);
    expect(html).toContain("Customer Profile");
    expect(html).toContain("0800000000");
    expect(html).toContain("LINE ID");
    expect(html).toContain('aria-label="คัดลอก LINE ID"');
    expect(html.indexOf("Customer Profile")).toBeLessThan(html.indexOf("U0123456789"));
  });

  it("does not derive a customer name from LINE ID when the profile name is absent", async () => {
    prismaMock.payment.findMany.mockResolvedValue([
      createPayment({
        displayName: "   ",
        phone: "   "
      })
    ]);

    const data = await getAdminPayments();

    expect(data.payments[0]).toMatchObject({
      customerName: "ผู้ใช้ LINE ยังไม่ระบุชื่อ",
      customerPhone: null,
      customerLineId: "U0123456789"
    });
  });
});
