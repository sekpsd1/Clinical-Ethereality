import { describe, expect, it } from "vitest";
import { updateUserRoleSchema } from "@/features/admin/users/schema";
import { cartMutationSchema } from "@/features/cart/schema";
import { articleIdSchema, commentSchema, reportContentSchema } from "@/features/community/article/schema";
import { getAssessmentRecommendation } from "@/features/consultations/assessment/rules";
import { submitConsultAssessmentSchema } from "@/features/consultations/assessment/schema";
import { sendConsultationMessageSchema } from "@/features/consultations/chat/schema";
import { getLegalDocument, getRequiredLegalDocuments } from "@/features/legal/documents";
import { acceptConsentSchema } from "@/features/legal/schema";
import { updateProfileContactSchema } from "@/features/profile/schema";
import { checkoutSchema } from "@/features/products/checkout/schema";
import { createExternalPrescriptionOrderSchema } from "@/features/products/prescriptions/schema";
import { getPrescriptionOrderStatusLabel, isPrescriptionOrderReady } from "@/features/products/prescriptions/readiness";
import { staffInviteRequestSchema } from "@/features/staff-invite/schema";

describe("feature validation schemas", () => {
  it("limits direct admin role changes to customer and admin accounts", () => {
    expect(updateUserRoleSchema.safeParse({ userId: "user-1", role: "admin" }).success).toBe(true);
    expect(updateUserRoleSchema.safeParse({ userId: "user-1", role: "customer" }).success).toBe(true);
    expect(updateUserRoleSchema.safeParse({ userId: "user-1", role: "doctor" }).success).toBe(false);
    expect(updateUserRoleSchema.safeParse({ userId: "", role: "admin" }).success).toBe(false);
  });

  it("requires a first and last name for licensed staff access requests", () => {
    expect(
      staffInviteRequestSchema.safeParse({
        role: "doctor",
        firstName: "สมชาย",
        lastName: "ใจดี",
        licenseNumber: "ว.12345",
        specialty: "เวชศาสตร์ครอบครัว"
      }).success
    ).toBe(true);
    expect(
      staffInviteRequestSchema.safeParse({
        role: "doctor",
        firstName: "",
        lastName: ""
      }).success
    ).toBe(false);
    expect(
      staffInviteRequestSchema.safeParse({
        role: "pharmacist",
        firstName: "สมหญิง",
        lastName: "ใจดี",
        licenseNumber: "ภ.12345",
        pharmacyName: "บางกอก ไซโตเจเนติกซ์"
      }).success
    ).toBe(true);
    expect(
      staffInviteRequestSchema.safeParse({
        role: "pharmacist",
        firstName: "",
        lastName: ""
      }).success
    ).toBe(false);
    expect(staffInviteRequestSchema.safeParse({ role: "admin" }).success).toBe(true);
  });

  it("validates and normalizes customer contact details", () => {
    expect(
      updateProfileContactSchema.parse({
        email: " customer@example.com ",
        phone: "081-234-5678"
      })
    ).toEqual({
      email: "customer@example.com",
      phone: "0812345678"
    });

    expect(
      updateProfileContactSchema.safeParse({
        email: "invalid-email",
        phone: "123"
      }).success
    ).toBe(false);
  });

  it("validates cart mutations with bounded integer quantities", () => {
    expect(cartMutationSchema.parse({ slug: "vitamin-c-complex" })).toEqual({
      slug: "vitamin-c-complex",
      quantity: 1
    });
    expect(cartMutationSchema.parse({ slug: "vitamin-c-complex", quantity: "3" }).quantity).toBe(3);
    expect(cartMutationSchema.safeParse({ slug: "vitamin-c-complex", quantity: 11 }).success).toBe(false);
    expect(cartMutationSchema.safeParse({ slug: "", quantity: 1 }).success).toBe(false);
  });

  it("validates checkout product slug payloads for customer order creation", () => {
    expect(checkoutSchema.parse({ productSlugs: "vitamin-c-complex" }).productSlugs).toEqual(["vitamin-c-complex"]);
    expect(checkoutSchema.parse({ productSlugs: ["a", "b"] }).productSlugs).toEqual(["a", "b"]);
    expect(checkoutSchema.safeParse({ productSlugs: [] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ productSlugs: Array.from({ length: 11 }, (_, index) => `product-${index}`) }).success).toBe(false);
  });

  it("validates community article interactions without accepting empty sensitive context", () => {
    expect(articleIdSchema.safeParse("article-1").success).toBe(true);
    expect(articleIdSchema.safeParse("").success).toBe(false);
    expect(commentSchema.parse({ articleId: "article-1", body: "  Helpful note  " }).body).toBe("Helpful note");
    expect(commentSchema.safeParse({ articleId: "article-1", body: "" }).success).toBe(false);
    expect(reportContentSchema.parse({ itemId: "comment-1", reason: "  Needs review  " }).reason).toBe("Needs review");
    expect(reportContentSchema.safeParse({ itemId: "comment-1", reason: "x".repeat(241) }).success).toBe(false);
  });

  it("validates versioned legal consent acceptance payloads", () => {
    const requiredDocuments = getRequiredLegalDocuments();

    expect(requiredDocuments).toHaveLength(5);
    expect(getLegalDocument("health_data")?.version).toBe("2026-05-20-draft");
    expect(
      acceptConsentSchema.safeParse({
        type: "health_data",
        version: "2026-05-20-draft"
      }).success
    ).toBe(true);
    expect(
      acceptConsentSchema.safeParse({
        type: "unknown",
        version: "2026-05-20-draft"
      }).success
    ).toBe(false);
    expect(
      acceptConsentSchema.safeParse({
        type: "health_data",
        version: ""
      }).success
    ).toBe(false);
  });

  it("validates consult assessment answers and maps recommendation topics", () => {
    expect(
      submitConsultAssessmentSchema.safeParse({
        symptom: "headache",
        duration: "1-3days"
      }).success
    ).toBe(true);
    expect(
      submitConsultAssessmentSchema.safeParse({
        symptom: "unknown",
        duration: "1-3days"
      }).success
    ).toBe(false);
    expect(getAssessmentRecommendation("cough", "more3days")).toMatchObject({
      topic: "ไอหรือเจ็บคอ",
      specialty: "สูตินรีเวช และเวชศาสตร์มารดาและทารกในครรภ์"
    });
  });

  it("validates in-app consultation chat messages", () => {
    expect(
      sendConsultationMessageSchema.safeParse({
        consultationId: "consultation-1",
        body: "  สวัสดีค่ะคุณหมอ  "
      }).success
    ).toBe(true);
    expect(
      sendConsultationMessageSchema.safeParse({
        consultationId: "consultation-1",
        body: ""
      }).success
    ).toBe(false);
    expect(
      sendConsultationMessageSchema.safeParse({
        consultationId: "",
        body: "ข้อความ"
      }).success
    ).toBe(false);
  });

  it("treats doctor-issued prescriptions as ready for direct ordering", () => {
    expect(isPrescriptionOrderReady("pending_verification")).toBe(true);
    expect(isPrescriptionOrderReady("verified")).toBe(true);
    expect(isPrescriptionOrderReady("draft")).toBe(false);
    expect(getPrescriptionOrderStatusLabel("pending_verification")).toBe("แพทย์ออกใบสั่งยาแล้ว");
  });

  it("validates external prescription attachment metadata before ordering", () => {
    expect(
      createExternalPrescriptionOrderSchema.safeParse({
        productSlug: "rx-product",
        attachmentUrl: "https://storage.example/prescriptions/rx-1.pdf",
        fileName: "rx-1.pdf",
        mimeType: "application/pdf"
      }).success
    ).toBe(true);
    expect(
      createExternalPrescriptionOrderSchema.safeParse({
        productSlug: "rx-product",
        attachmentUrl: "not-a-url",
        fileName: "rx-1.pdf"
      }).success
    ).toBe(false);
    expect(
      createExternalPrescriptionOrderSchema.safeParse({
        productSlug: "rx-product",
        attachmentUrl: "https://storage.example/prescriptions/rx-1.pdf",
        fileName: ""
      }).success
    ).toBe(false);
  });
});
