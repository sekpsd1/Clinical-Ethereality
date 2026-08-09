import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attachmentFindUnique: vi.fn(),
  getCurrentSession: vi.fn(),
  hasPermission: vi.fn(),
  paymentFindUnique: vi.fn(),
  readPrivatePaymentSlip: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/lib/permissions", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    fileAttachment: { findUnique: mocks.attachmentFindUnique },
    payment: { findUnique: mocks.paymentFindUnique }
  }
}));
vi.mock("@/features/payments/private-slips", () => ({
  paymentSlipEntityType: "payment_slip",
  readPrivatePaymentSlip: mocks.readPrivatePaymentSlip
}));

import { GET } from "@/app/api/payments/slips/[attachmentId]/route";

describe("private payment slip read route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not expose a private slip without a session", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/payments/slips/slip-1"), {
      params: Promise.resolve({ attachmentId: "slip-1" })
    });

    expect(response.status).toBe(401);
    expect(mocks.attachmentFindUnique).not.toHaveBeenCalled();
  });

  it("allows only the payment owner and marks its response non-public", async () => {
    mocks.getCurrentSession.mockResolvedValue({ userId: "customer-1", role: "customer" });
    mocks.attachmentFindUnique.mockResolvedValue({
      entityId: "payment-1",
      entityType: "payment_slip",
      ownerId: "customer-1",
      status: "attached",
      storageKey: "payments/a/b/slip.png",
      mimeType: "image/png"
    });
    mocks.paymentFindUnique.mockResolvedValue({ order: { userId: "customer-1" }, consultation: null });
    mocks.readPrivatePaymentSlip.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const response = await GET(new Request("http://localhost/api/payments/slips/slip-1"), {
      params: Promise.resolve({ attachmentId: "slip-1" })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("rejects another customer even when the attachment id is known", async () => {
    mocks.getCurrentSession.mockResolvedValue({ userId: "customer-2", role: "customer" });
    mocks.hasPermission.mockReturnValue(false);
    mocks.attachmentFindUnique.mockResolvedValue({
      entityId: "payment-1",
      entityType: "payment_slip",
      ownerId: "customer-1",
      status: "attached",
      storageKey: "payments/a/b/slip.png",
      mimeType: "image/png"
    });
    mocks.paymentFindUnique.mockResolvedValue({ order: { userId: "customer-1" }, consultation: null });

    const response = await GET(new Request("http://localhost/api/payments/slips/slip-1"), {
      params: Promise.resolve({ attachmentId: "slip-1" })
    });

    expect(response.status).toBe(404);
    expect(mocks.readPrivatePaymentSlip).not.toHaveBeenCalled();
  });

  it("allows an authorized admin without making the file public", async () => {
    mocks.getCurrentSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mocks.hasPermission.mockReturnValue(true);
    mocks.attachmentFindUnique.mockResolvedValue({
      entityId: "payment-1",
      entityType: "payment_slip",
      ownerId: "customer-1",
      status: "attached",
      storageKey: "payments/a/b/slip.png",
      mimeType: "image/png"
    });
    mocks.paymentFindUnique.mockResolvedValue({ order: { userId: "customer-1" }, consultation: null });
    mocks.readPrivatePaymentSlip.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const response = await GET(new Request("http://localhost/api/payments/slips/slip-1"), {
      params: Promise.resolve({ attachmentId: "slip-1" })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
