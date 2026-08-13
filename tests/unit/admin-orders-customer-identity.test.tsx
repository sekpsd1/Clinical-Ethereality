import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  order: {
    findMany: vi.fn()
  },
  fileAttachment: {
    findMany: vi.fn()
  },
  auditLog: {
    findMany: vi.fn()
  }
}));

vi.mock("next/cache", () => ({
  unstable_noStore: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock
}));

import { AdminOrders } from "@/features/admin/AdminOrders";
import { getAdminOrders } from "@/features/admin/orders/queries";

function createOrder(
  overrides: {
    displayName?: string | null;
    phone?: string | null;
    shippingAddress?: {
      recipientName: string;
      phone: string;
    } | null;
  } = {}
) {
  return {
    id: "order-abcdef",
    user: {
      displayName: overrides.displayName === undefined ? "  Customer Profile  " : overrides.displayName,
      phone: overrides.phone === undefined ? "  0800000000  " : overrides.phone,
      phoneVerifiedAt: new Date("2026-08-13T16:26:00.000Z"),
      lineUserId: "U0123456789"
    },
    items: [],
    payments: [],
    shipments: [],
    shippingAddress: overrides.shippingAddress === undefined
      ? null
      : {
          id: "shipping-address-1",
          label: "บ้าน",
          recipientName: overrides.shippingAddress?.recipientName ?? "",
          phone: overrides.shippingAddress?.phone ?? "",
          addressLine1: "1 ถนนสุขุมวิท",
          addressLine2: null,
          subdistrict: "คลองตัน",
          district: "วัฒนา",
          province: "กรุงเทพมหานคร",
          postalCode: "10110"
        },
    status: "pending_payment",
    grandTotal: 1,
    createdAt: new Date("2026-08-13T16:27:00.000Z")
  };
}

describe("Admin Orders customer identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.fileAttachment.findMany.mockResolvedValue([]);
    prismaMock.auditLog.findMany.mockResolvedValue([]);
  });

  it("labels profile and shipping recipient phone numbers separately without exposing the raw LINE ID", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      createOrder({
        shippingAddress: {
          recipientName: "Parcel Recipient",
          phone: "0900000000"
        }
      })
    ]);

    const data = await getAdminOrders();

    expect(data.orders[0]).toMatchObject({
      customerName: "Customer Profile",
      customerPhone: "0800000000",
      customerPhoneVerificationStatus: "verified"
    });

    const html = renderToStaticMarkup(<AdminOrders data={data} />);
    expect(html).toContain("Customer Profile");
    expect(html).toContain("เบอร์โปรไฟล์ (ยืนยันแล้ว): 0800000000");
    expect(html).toContain("ผู้รับพัสดุ: Parcel Recipient");
    expect(html).toContain("เบอร์ผู้รับพัสดุ: 0900000000");
    expect(html).not.toContain("U0123456789");
  });

  it("uses a neutral fallback and does not fabricate a name from LINE ID or phone", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      createOrder({
        displayName: "   ",
        phone: "   "
      })
    ]);

    const data = await getAdminOrders();

    expect(data.orders[0]).toMatchObject({
      customerName: "ผู้ใช้ LINE ยังไม่ระบุชื่อ",
      customerPhone: null
    });

    const html = renderToStaticMarkup(<AdminOrders data={data} />);
    expect(html).toContain("เบอร์โปรไฟล์: ไม่ได้ระบุ");
  });
});
