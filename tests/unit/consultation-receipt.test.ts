import { beforeEach, describe, expect, it, vi } from "vitest";
import { getReceiptModel, formatReceiptDate, type ReceiptPayment } from "@/features/consultations/receipt/model";
import type { PublicSession } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), payment: vi.fn(), render: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  user: { findFirst: mocks.user }, payment: { findFirst: mocks.payment }
} }));
vi.mock("@/features/consultations/receipt/pdf", () => ({ renderConsultationReceipt: mocks.render }));
import { GET } from "@/app/api/consultations/[consultationId]/receipt/route";
import { getConsultationReceiptHref } from "@/features/consultations/receipt/queries";

const session: PublicSession = {
  userId: "customer-1", lineUserId: "line-1", role: "customer", sessionId: "session-1",
  expiresAt: "2099-01-01T00:00:00Z"
};
function fixture(overrides: Partial<ReceiptPayment> = {}): ReceiptPayment {
  return {
    id: "payment-1", consultationId: "consult-1", orderId: null,
    status: "verified", method: "promptpay", amount: { toString: () => "1234.50" },
    reviewedAt: new Date("2026-01-31T18:00:00Z"), refundAmount: null,
    refundReason: null, refundedAt: null, refundedById: null,
    refundTransactionReference: null, normalizedRefundReference: null, ...overrides
  };
}
const request = new Request("https://example.test/api/consultations/consult-1/receipt");
const context = { params: Promise.resolve({ consultationId: "consult-1" }) };

describe("consultation receipt eligibility", () => {
  it.each(["pending_slip", "pending_review", "rejected", "refunded"])("withholds %s", status => {
    expect(getReceiptModel(fixture({ status }), "consult-1", "ทดสอบ Test")).toBeNull();
  });
  it.each(["refundAmount", "refundReason", "refundedAt", "refundedById", "refundTransactionReference", "normalizedRefundReference"] as const)("withholds contradictory %s even when verified", key => {
    expect(getReceiptModel(fixture({ [key]: key === "refundAmount" ? 0 : "" }), "consult-1", "ทดสอบ")).toBeNull();
  });
  it.each(["0", "-1", "NaN", "Infinity", "100000000", "1.001", "1e3"])("rejects invalid amount %s", amount => {
    expect(getReceiptModel(fixture({ amount: { toString: () => amount } }), "consult-1", "ทดสอบ")).toBeNull();
  });
  it("fails closed for Store/hybrid, wrong consultation, missing/invalid/future date and missing name", () => {
    for (const change of [{ orderId: "order-1" }, { consultationId: null }, { method: "cash" },
      { reviewedAt: null }, { reviewedAt: new Date("invalid") }, { reviewedAt: new Date("2099-01-01") }]) {
      expect(getReceiptModel(fixture(change), "consult-1", "ทดสอบ")).toBeNull();
    }
    for (const name of [null, "", "  ", "evil\nname", "name\u202e", "ก".repeat(256), "ทดสอบ😀", "测试"]) {
      expect(getReceiptModel(fixture(), "consult-1", name)).toBeNull();
    }
  });
  it("keeps actual paid Decimal, stable full payment reference and Bangkok confirmation date", () => {
    const a = getReceiptModel(fixture(), "consult-1", "ทดสอบ Test")!;
    expect(a.reference).toBe("CP-payment-1");
    expect(a.amount).toBe("1234.50");
    expect(a.currency).toBe("THB");
    expect(a).toEqual(getReceiptModel(fixture(), "consult-1", "ทดสอบ Test"));
    expect(formatReceiptDate(a.confirmedAt)).toContain("1 กุมภาพันธ์");
    expect(formatReceiptDate(a.confirmedAt)).toContain("01:00");
  });
});

describe("private owned receipt download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue(session);
    mocks.user.mockResolvedValue({ displayName: "ทดสอบ Test" });
    mocks.payment.mockResolvedValue(fixture());
    mocks.render.mockResolvedValue(Buffer.from("%PDF-synthetic"));
  });
  async function expectDenied(status: number, ctx = context) {
    const response = await GET(request, ctx);
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(mocks.render).not.toHaveBeenCalled();
    return response;
  }
  it("denies no session before querying private data", async () => {
    mocks.session.mockResolvedValue(null);
    await expectDenied(401);
    expect(mocks.user).not.toHaveBeenCalled();
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it.each(["admin", "doctor", "pharmacist"])("denies %s", async role => {
    mocks.session.mockResolvedValue({ ...session, role });
    await expectDenied(403);
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("denies dev and legacy sessions without revocation binding", async () => {
    for (const change of [{ userId: "dev:customer" }, { sessionId: undefined }]) {
      mocks.session.mockResolvedValue({ ...session, ...change });
      await expectDenied(403);
    }
  });
  it("denies inactive/deleted/expired/revoked session before payment lookup", async () => {
    mocks.user.mockResolvedValue(null);
    await expectDenied(403);
    expect(mocks.user).toHaveBeenCalledWith(expect.objectContaining({ where: {
      id: session.userId, role: "customer", status: "active", authSessions: { some: {
        id: "session-1", status: "active", revokedAt: null, expiresAt: { gt: expect.any(Date) }
      } }
    } }));
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("uses identical denial for other owner or missing record; relation is scoped in DB", async () => {
    mocks.payment.mockResolvedValue(null);
    await expectDenied(404);
    expect(mocks.payment).toHaveBeenCalledWith(expect.objectContaining({ where: {
      consultationId: "consult-1", orderId: null,
      consultation: { is: { id: "consult-1", patientId: "customer-1" } }
    } }));
    const selection = mocks.payment.mock.calls[0][0].select;
    expect(selection).not.toHaveProperty("verificationPayload");
    expect(selection).not.toHaveProperty("consultation");
  });
  it.each(["pending_slip", "pending_review", "rejected", "refunded"])("does not render %s even for a completed consultation", async status => {
    mocks.payment.mockResolvedValue({ ...fixture({ status }), consultation: { status: "completed" } });
    await expectDenied(404);
  });
  it("denies a different active Customer requesting the same consultation URL", async () => {
    mocks.session.mockResolvedValue({ ...session, userId: "customer-2", sessionId: "session-2" });
    mocks.payment.mockImplementation(async ({ where }) =>
      where.consultation.is.patientId === "customer-1" ? fixture() : null);
    await expectDenied(404);
    expect(mocks.payment.mock.calls[0][0].where.consultation.is.patientId).toBe("customer-2");
  });
  it("rejects malformed identifiers and never exposes failure details", async () => {
    await expectDenied(404, { params: Promise.resolve({ consultationId: "../secret" }) });
    mocks.payment.mockRejectedValue(new Error("private provider payload"));
    const response = await expectDenied(503);
    expect(await response.text()).not.toContain("private provider");
  });
  it.each(["provider", "manual"])("renders verified %s payment read-only with private attachment headers", async source => {
    mocks.payment.mockResolvedValue({ ...fixture(), source });
    const response = await GET(request, context);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="consultation-payment-receipt.pdf"');
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(mocks.render).toHaveBeenCalledWith(getReceiptModel(fixture(), "consult-1", "ทดสอบ Test"));
    await GET(request, context);
    expect(mocks.render.mock.calls[0]).toEqual(mocks.render.mock.calls[1]);
    // Mock only exposes SELECT methods: any business write/provider dependency fails this test.
  });
  it("advertises history link only through the same authoritative eligibility query", async () => {
    expect(await getConsultationReceiptHref(session, "consult-1")).toBe("/api/consultations/consult-1/receipt");
    mocks.payment.mockResolvedValue(fixture({ status: "pending_review" }));
    expect(await getConsultationReceiptHref(session, "consult-1")).toBeNull();
  });
  it("returns private generic 503 if rendering fails, with no private failure details", async () => {
    mocks.render.mockRejectedValue(new Error("private name or font path"));
    const response = await GET(request, context);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(await response.text()).not.toContain("private name");
  });
});
