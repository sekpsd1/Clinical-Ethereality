import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as downloadReceipt } from "@/app/api/admin/payments/[paymentId]/receipt/route";
import { GET as shippingAddress } from "@/app/api/admin/orders/[orderId]/shipping-address/route";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  admin: vi.fn(),
  payment: vi.fn(),
  snapshot: vi.fn()
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  user: { findFirst: mocks.admin },
  payment: { findUnique: mocks.payment },
  orderShippingAddress: { findUnique: mocks.snapshot }
} }));

const admin = { role: "admin", userId: "admin-1", sessionId: "session-1" };
const payment = {
  id: "payment-1", method: "promptpay", status: "verified", amount: "700",
  reviewedAt: new Date("2026-10-16T04:30:00.000Z"),
  consultationId: "consultation-1", orderId: null,
  consultation: { patient: { fullName: "ทดสอบ ใจดี", displayName: null } }, order: null
};
const orderPayment = {
  ...payment,
  consultation: null, consultationId: null, orderId: "order-a",
  order: {
    status: "paid", user: { fullName: "ทดสอบ ตั้งใจ", displayName: null },
    shippingTotal: "20", discountTotal: "0",
    items: [{ quantity: 2, lineTotal: "680", product: { name: "สินค้าทดสอบ" } }]
  }
};
const snapshot = {
  recipientName: "ทดสอบ รับพัสดุ", phone: "0800000000",
  addressLine1: "123 ซอยทดสอบ", addressLine2: "อาคารตัวอย่าง <script>alert(1)</script> & บี",
  subdistrict: "จอมพล", district: "จตุจักร", province: "กรุงเทพมหานคร", postalCode: "10900",
  label: "Private nickname", sourceAddressId: "Private address ID"
};

function receipt() {
  return downloadReceipt(new Request("https://example.test/api/admin/payments/payment-1/receipt?ticket=ignored"), {
    params: Promise.resolve({ paymentId: "payment-1" })
  });
}

function address(orderId = "order-a", download = false) {
  return shippingAddress(new Request(`https://example.test/api/admin/orders/${orderId}/shipping-address?download=${Number(download)}`), {
    params: Promise.resolve({ orderId })
  });
}

describe("Admin document routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue(admin);
    mocks.admin.mockResolvedValue({ id: admin.userId });
    mocks.payment.mockResolvedValue(payment);
    mocks.snapshot.mockResolvedValue(snapshot);
  });

  it.each([
    ["anonymous", null, 401],
    ["customer", { ...admin, role: "customer" }, 403],
    ["doctor", { ...admin, role: "doctor" }, 403],
    ["pharmacist", { ...admin, role: "pharmacist" }, 403],
    ["dev", { ...admin, userId: "dev:admin" }, 403],
    ["unbound Admin", { ...admin, sessionId: undefined }, 403],
    ["inactive Admin or revoked session", admin, 403]
  ])("denies %s before reading either document", async (_role, session, status) => {
    mocks.session.mockResolvedValue(session);
    mocks.admin.mockResolvedValue(null);
    mocks.payment.mockResolvedValue(orderPayment);
    for (const response of await Promise.all([receipt(), address(), address("order-a", true)])) {
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toMatch(/private, no-store/);
    }
    expect(mocks.payment).not.toHaveBeenCalled();
    expect(mocks.snapshot).not.toHaveBeenCalled();
    if (session === admin) {
      expect(mocks.admin).toHaveBeenCalledWith({
        where: {
          id: "admin-1", role: "admin", status: "active",
          authSessions: { some: { id: "session-1", status: "active", revokedAt: null, expiresAt: { gt: expect.any(Date) } } }
        },
        select: { id: true }
      });
    }
  });

  it.each([
    ["consultation", payment, "consultation-payment-receipt.pdf"],
    ["store", orderPayment, "store-payment-receipt.pdf"]
  ])("downloads a Thai PDF for the exact verified %s payment", async (_type, record, filename) => {
    mocks.payment.mockResolvedValueOnce({ ...record, status: "pending_review" }).mockResolvedValueOnce(record);
    expect((await receipt()).status).toBe(404);
    const response = await receipt();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(`attachment; filename="${filename}"`);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.toString("latin1")).toContain("NotoSansThai");
    expect(mocks.payment).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: "payment-1", status: "verified" },
      select: expect.not.objectContaining({ verificationPayload: true, qrPayload: true })
    }));
  });

  it.each([
    null,
    { ...payment, status: "pending_slip" },
    { ...payment, status: "rejected" },
    { ...payment, status: "refunded" },
    { ...payment, refundAmount: "100" },
    { ...payment, reviewedAt: null },
    { ...payment, orderId: "order-a" },
    { ...orderPayment, order: { ...orderPayment.order, status: "pending_payment" } }
  ])("declines missing, ambiguous or ineligible payment records", async record => {
    mocks.payment.mockResolvedValue(record);
    expect((await receipt()).status).toBe(404);
  });

  it("serves only the requested snapshot in a printable preview and an inert download", async () => {
    mocks.snapshot.mockImplementation(async ({ where }) => where.orderId === "order-a"
      ? snapshot : { ...snapshot, recipientName: "ผู้รับออเดอร์อื่น" });
    const preview = await address();
    const download = await address("order-a", true);
    expect(preview.status).toBe(200);
    expect(preview.headers.get("content-disposition")).toBe('inline; filename="shipping-address.html"');
    expect(download.headers.get("content-disposition")).toBe('attachment; filename="shipping-address.html"');
    expect(preview.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(preview.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(download.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    const html = await preview.text();
    const saved = await download.text();
    for (const document of [html, saved]) {
      expect(document).toContain("ทดสอบ รับพัสดุ");
      expect(document).toContain("แขวง จอมพล เขต จตุจักร กรุงเทพมหานคร 10900");
      expect(document).toContain("0800000000");
      expect(document).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp;");
      expect(document).not.toMatch(/Private nickname|Private address ID|ผู้รับออเดอร์อื่น/);
    }
    const nonce = html.match(/<script nonce="([^"]+)">/)?.[1];
    expect(nonce).toBeTruthy();
    expect(preview.headers.get("content-security-policy")).toContain(`'nonce-${nonce}'`);
    expect(html).toContain("window.print()");
    expect(saved).not.toContain("<script");
    expect(await (await address("order-b")).text()).toContain("ผู้รับออเดอร์อื่น");
    expect(mocks.snapshot).toHaveBeenLastCalledWith({
      where: { orderId: "order-b" },
      select: {
        recipientName: true, phone: true, addressLine1: true, addressLine2: true,
        subdistrict: true, district: true, province: true, postalCode: true
      }
    });
  });

  it.each([null, { ...snapshot, recipientName: " " }])("returns a private 404 instead of an empty address document", async record => {
    mocks.snapshot.mockResolvedValue(record);
    const response = await address("order-a", true);
    expect(response.status).toBe(404);
    expect(response.headers.has("content-disposition")).toBe(false);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
