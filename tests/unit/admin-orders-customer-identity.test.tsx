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

function createOrder(overrides: { displayName?: string | null; phone?: string | null } = {}) {
  return {
    id: "order-abcdef",
    user: {
      displayName: overrides.displayName === undefined ? "  Customer Profile  " : overrides.displayName,
      phone: overrides.phone === undefined ? "  0800000000  " : overrides.phone,
      lineUserId: "U0123456789"
    },
    items: [],
    payments: [],
    shipments: [],
    shippingAddress: null,
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

  it("uses the stored profile display name and phone without exposing the raw LINE ID", async () => {
    prismaMock.order.findMany.mockResolvedValue([createOrder()]);

    const data = await getAdminOrders();

    expect(data.orders[0]).toMatchObject({
      customerName: "Customer Profile",
      customerPhone: "0800000000"
    });

    const html = renderToStaticMarkup(<AdminOrders data={data} />);
    expect(html).toContain("Customer Profile");
    expect(html).toContain("0800000000");
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
  });
});
