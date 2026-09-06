import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  noStore: vi.fn(),
  orderFindMany: vi.fn(),
  fileAttachmentFindMany: vi.fn(),
  getQrDataUrlFromPayload: vi.fn(),
  isPaymentReadyForProviderVerification: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("next/cache", () => ({
  unstable_noStore: mocks.noStore
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    order: {
      findMany: mocks.orderFindMany
    },
    fileAttachment: {
      findMany: mocks.fileAttachmentFindMany
    },
    $transaction: mocks.transaction
  }
}));

vi.mock("@/lib/payments/promptpay", () => ({
  getQrDataUrlFromPayload: mocks.getQrDataUrlFromPayload
}));

vi.mock("@/features/payments/service", () => ({
  isPaymentReadyForProviderVerification: mocks.isPaymentReadyForProviderVerification
}));

import { CustomerOrders } from "@/features/orders/CustomerOrders";
import { getCustomerOrders } from "@/features/orders/queries";

describe("customer order queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orderFindMany.mockResolvedValue([]);
    mocks.fileAttachmentFindMany.mockResolvedValue([]);
    mocks.getQrDataUrlFromPayload.mockResolvedValue(null);
    mocks.isPaymentReadyForProviderVerification.mockReturnValue(false);
  });

  it("does not mutate reservations while reading an empty customer order list", async () => {
    await expect(getCustomerOrders({ userId: "customer-1" } as never)).resolves.toEqual({
      orders: [],
      summary: {
        active: 0,
        paymentReview: 0,
        completed: 0
      }
    });

    expect(mocks.noStore).toHaveBeenCalledOnce();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("maps and displays the carrier and tracking number after shipment", async () => {
    mocks.orderFindMany.mockResolvedValue([
      {
        id: "order-abcdef",
        status: "shipped",
        grandTotal: 850,
        createdAt: new Date("2026-09-05T03:00:00.000Z"),
        updatedAt: new Date("2026-09-05T04:00:00.000Z"),
        items: [
          {
            quantity: 1,
            product: { name: "Clinical Product" },
            prescription: null
          }
        ],
        payments: [
          {
            id: "payment-1",
            status: "verified",
            qrPayload: null
          }
        ],
        shipments: [
          {
            status: "shipped",
            carrier: "Thailand Post",
            trackingNumber: "EM123456789TH"
          }
        ],
        shippingAddress: null
      }
    ]);

    const data = await getCustomerOrders({ userId: "customer-1", role: "customer" } as never);

    expect(data.orders[0]).toMatchObject({
      carrier: "Thailand Post",
      trackingNumber: "EM123456789TH",
      statusLabel: "จัดส่งแล้ว"
    });
    expect(data.orders[0].steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "จัดส่ง",
        description: "ขนส่ง: Thailand Post · เลขพัสดุ: EM123456789TH"
      })
    ]));

    const html = renderToStaticMarkup(CustomerOrders({ data }));
    expect(html).toContain("Thailand Post · EM123456789TH");
    expect(html).toContain("จัดเตรียมโดยทีมงาน");
    expect(html).not.toContain("จัดเตรียมโดยเภสัชกร");
  });
});
