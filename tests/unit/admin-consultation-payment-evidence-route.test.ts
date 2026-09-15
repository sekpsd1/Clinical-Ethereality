import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attachmentFindUnique: vi.fn(),
  getCurrentSession: vi.fn(),
  hasPermission: vi.fn(),
  paymentFindUnique: vi.fn(),
  readPrivatePaymentSlip: vi.fn(),
  userFindFirst: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: mocks.getCurrentSession
}));
vi.mock("@/lib/permissions", () => ({
  hasPermission: mocks.hasPermission
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    fileAttachment: { findUnique: mocks.attachmentFindUnique },
    payment: { findUnique: mocks.paymentFindUnique },
    user: { findFirst: mocks.userFindFirst }
  }
}));
vi.mock("@/features/payments/private-slips", () => ({
  consultationManualReviewEvidenceEntityType:
    "consultation_manual_review_evidence",
  readPrivatePaymentSlip: mocks.readPrivatePaymentSlip
}));

import { GET } from "@/app/api/admin/payments/evidence/[attachmentId]/route";

const request = new Request(
  "http://localhost/api/admin/payments/evidence/evidence-1"
);
const context = {
  params: Promise.resolve({ attachmentId: "evidence-1" })
};

describe("Admin consultation payment evidence route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue({
      userId: "admin-1",
      role: "admin"
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.userFindFirst.mockResolvedValue({ id: "admin-1" });
    mocks.attachmentFindUnique.mockResolvedValue({
      id: "evidence-1",
      entityId: "payment-1",
      entityType: "consultation_manual_review_evidence",
      mimeType: "image/png",
      ownerId: "admin-reviewer-1",
      purpose: "other",
      status: "attached",
      storageKey: "payments/admin/evidence.png"
    });
    mocks.paymentFindUnique.mockResolvedValue({
      consultationId: "consultation-1",
      reviewedById: "admin-reviewer-1",
      verificationPayload: {
        manualReview: {
          supportingEvidenceAttachmentId: "evidence-1"
        }
      }
    });
    mocks.readPrivatePaymentSlip.mockResolvedValue(
      new Uint8Array([1, 2, 3])
    );
  });

  it("serves bound evidence only to an active authorized Admin", async () => {
    const response = await GET(request, context);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("rejects non-Admin roles before reading attachment metadata", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      userId: "customer-1",
      role: "customer"
    });
    mocks.hasPermission.mockReturnValue(false);

    const response = await GET(request, context);

    expect(response.status).toBe(403);
    expect(mocks.userFindFirst).not.toHaveBeenCalled();
    expect(mocks.attachmentFindUnique).not.toHaveBeenCalled();
  });

  it("rejects an inactive Admin even if an access token still exists", async () => {
    mocks.userFindFirst.mockResolvedValue(null);

    const response = await GET(request, context);

    expect(response.status).toBe(403);
    expect(mocks.attachmentFindUnique).not.toHaveBeenCalled();
  });

  it("fails closed when the attachment is substituted onto another payment", async () => {
    mocks.paymentFindUnique.mockResolvedValue({
      consultationId: "consultation-1",
      reviewedById: "admin-reviewer-1",
      verificationPayload: {
        manualReview: {
          supportingEvidenceAttachmentId: "evidence-other"
        }
      }
    });

    const response = await GET(request, context);

    expect(response.status).toBe(404);
    expect(mocks.readPrivatePaymentSlip).not.toHaveBeenCalled();
  });
});
