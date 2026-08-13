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

function createPayment(
  overrides: { displayName?: string | null; phone?: string | null; status?: "pending_slip" | "verified"; reviewedAt?: Date | null } = {}
) {
  return {
    id: "payment-1",
    orderId: "order-abcdef",
    consultationId: null,
    order: {
      user: {
        displayName: overrides.displayName === undefined ? "  Customer Profile  " : overrides.displayName,
        phone: overrides.phone === undefined ? "  0800000000  " : overrides.phone,
        phoneVerifiedAt: new Date("2026-08-13T16:26:00.000Z"),
        lineUserId: "U0123456789"
      },
      items: []
    },
    consultation: null,
    reviewedBy: null,
    amount: 1,
    method: "promptpay",
    status: overrides.status ?? "pending_slip",
    slipImageUrl: "/api/payments/slips/private-slip-id",
    qrPayload: "000201010212-private-qr-payload",
    verificationPayload: {
      source: "slipok",
      result: {
        status: "verified",
        transRef: "private-transfer-reference",
        receiverName: "Private Receiver Name",
        amount: 1
      }
    },
    createdAt: new Date("2026-08-13T16:27:00.000Z"),
    reviewedAt: overrides.reviewedAt ?? null
  };
}

describe("Admin Payments customer identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the stored profile display name and phone with a redacted operational payment summary", async () => {
    prismaMock.payment.findMany.mockResolvedValue([
      createPayment({
        status: "verified",
        reviewedAt: new Date("2026-08-13T16:30:00.000Z")
      })
    ]);

    const data = await getAdminPayments();

    expect(data.payments[0]).toMatchObject({
      customerName: "Customer Profile",
      customerPhone: "0800000000",
      customerPhoneVerificationStatus: "verified",
      receiverLabel: "ตรวจสอบผู้รับแล้ว"
    });

    const html = renderToStaticMarkup(<AdminPayments data={data} />);
    expect(html).toContain("Customer Profile");
    expect(html).toContain("เบอร์โปรไฟล์ (ยืนยันแล้ว): 0800000000");
    expect(html).toContain("SlipOK");
    expect(html).toContain("ตรวจสอบผู้รับแล้ว");
    expect(html).toContain("ตรวจสอบเมื่อ");
    expect(html).not.toContain("U0123456789");
    expect(html).not.toContain("/api/payments/slips/private-slip-id");
    expect(html).not.toContain("000201010212-private-qr-payload");
    expect(html).not.toContain("private-transfer-reference");
    expect(html).not.toContain("Private Receiver Name");
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
      customerPhone: null
    });

    const html = renderToStaticMarkup(<AdminPayments data={data} />);
    expect(html).toContain("เบอร์โปรไฟล์: ไม่ได้ระบุ");
  });
});
