import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/orders/[orderId]/receipt/route";
import { getOrderReceiptDetails } from "@/features/orders/receipt";
import type { ReceiptPayment } from "@/features/consultations/receipt/model";

const mocks = vi.hoisted(() => ({ session: vi.fn(), order: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { order: { findFirst: mocks.order } } }));

const session = {
  userId: "customer-1", lineUserId: "line-1", role: "customer" as const, sessionId: "session-1",
  expiresAt: "2099-01-01T00:00:00Z"
};
const request = new Request("https://example.test/api/orders/order-1/receipt");
const context = { params: Promise.resolve({ orderId: "order-1" }) };
function fixture(overrides: Partial<ReceiptPayment> = {}) {
  return {
    user: { displayName: "ลูกค้าทดสอบ" },
    shippingTotal: "20.00",
    discountTotal: "5.00",
    items: [{ quantity: 2, lineTotal: "135.00", product: { name: "สินค้าทดสอบ" } }],
    payments: [{
      id: "payment-1", consultationId: null, orderId: "order-1",
      status: "verified", method: "promptpay", amount: "150.00",
      reviewedAt: new Date("2026-01-31T18:00:00Z"), ...overrides
    }]
  };
}

describe("Store receipt download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue(session);
    mocks.order.mockResolvedValue(fixture());
  });

  it("returns an inline private JPEG for the owner only", async () => {
    const imageRequest = new Request(request.url + "?format=jpg");
    const response = await GET(imageRequest, context);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("content-disposition")).toMatch(/^inline;/);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([255, 216, 255]);

    const download = await GET(new Request(imageRequest.url + "&download=1"), context);
    expect(download.status).toBe(200);
    expect(download.headers.get("content-disposition")).toMatch(/^attachment;.*\.jpg/);

    mocks.session.mockResolvedValue(null);
    expect((await GET(imageRequest, context)).status).toBe(401);
  });

  it("returns a private Thai PDF for an owned verified order and advertises its URL", async () => {
    const response = await GET(request, context);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.toString("latin1")).toContain("NotoSansThai");
    expect(await getOrderReceiptDetails(session, "order-1")).toMatchObject({ receipt: { amount: "150.00" } });
  });

  it.each([null, "", "ทดสอบ😀", "测试"])("keeps the receipt available when account name %s cannot be printed", async displayName => {
    mocks.order.mockResolvedValue({ ...fixture(), user: { fullName: null, displayName } });
    expect(await getOrderReceiptDetails(session, "order-1")).toMatchObject({ receipt: { amount: "150.00" } });
    expect((await GET(request, context)).status).toBe(200);
  });

  it("scopes the order lookup to the customer and an active bound session", async () => {
    mocks.order.mockResolvedValue(null);
    expect((await GET(request, context)).status).toBe(404);
    expect(mocks.order).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "order-1", userId: "customer-1",
        status: { in: ["paid", "preparing", "shipped", "delivered"] },
        user: {
          role: "customer", status: "active",
          authSessions: { some: {
            id: "session-1", status: "active", revokedAt: null, expiresAt: { gt: expect.any(Date) }
          } }
        }
      }
    }));
  });

  it("denies anonymous and unbound sessions before querying orders", async () => {
    mocks.session.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...session, sessionId: null });
    expect((await GET(request, context)).status).toBe(401);
    expect((await GET(request, context)).status).toBe(403);
    expect(mocks.order).not.toHaveBeenCalled();
  });

  it.each([
    { status: "pending_review" }, { status: "rejected" }, { status: "refunded" },
    { refundAmount: "10.00" }, { reviewedAt: null }, { orderId: "other-order" },
    { consultationId: "consultation-1" }
  ])("withholds button and PDF for ineligible payment %o", async overrides => {
    mocks.order.mockResolvedValue(fixture(overrides));
    expect(await getOrderReceiptDetails(session, "order-1")).toBeNull();
    expect((await GET(request, context)).status).toBe(404);
  });
});
