import { describe, expect, it } from "vitest";
import { updateUserRoleSchema } from "@/features/admin/users/schema";
import { upsertProductSchema } from "@/features/admin/products/schema";
import { cartMutationSchema } from "@/features/cart/schema";
import { articleIdSchema, commentSchema, reportContentSchema } from "@/features/community/article/schema";
import { communityPostSchema } from "@/features/community/schema";
import { getAssessmentRecommendation } from "@/features/consultations/assessment/rules";
import { submitConsultAssessmentSchema } from "@/features/consultations/assessment/schema";
import { sendConsultationMessageSchema } from "@/features/consultations/chat/schema";
import { getLegalDocument, getRequiredLegalDocuments } from "@/features/legal/documents";
import { acceptConsentSchema } from "@/features/legal/schema";
import { updateProfileContactSchema } from "@/features/profile/schema";
import { checkoutSchema } from "@/features/products/checkout/schema";
import { getProductCategoryLabel } from "@/features/products/categories";
import { createExternalPrescriptionOrderSchema } from "@/features/products/prescriptions/schema";
import { getPrescriptionOrderStatusLabel, isPrescriptionOrderReady } from "@/features/products/prescriptions/readiness";
import { staffInviteRequestSchema } from "@/features/staff-invite/schema";

describe("feature validation schemas", () => {
  it("validates structured product details and controlled categories", () => {
    const product = {
      name: "HPV Home Test Kit",
      slug: "hpv-home-test-kit",
      category: "health-equipment",
      shortDescription: "ชุดตรวจสำหรับใช้งานที่บ้าน",
      description: "รายละเอียดฉบับเต็มสำหรับหน้าสินค้า",
      usageInstructions: "อ่านคู่มือก่อนใช้งาน",
      fdaNumber: "ระหว่างดำเนินการ",
      warnings: "ไม่ใช้หากบรรจุภัณฑ์เสียหาย",
      storageInstructions: "เก็บที่อุณหภูมิห้อง",
      specialFulfillmentNotes: "",
      imageUrl: "/images/products/test-kit.jpg",
      price: "1200.00",
      status: "draft",
      requiresPrescription: "false",
      controlledOrRestricted: "false"
    };

    expect(upsertProductSchema.safeParse(product).success).toBe(true);
    expect(upsertProductSchema.safeParse({ ...product, category: "uncontrolled-category" }).success).toBe(false);
    expect(upsertProductSchema.safeParse({ ...product, shortDescription: "x".repeat(301) }).success).toBe(false);
    expect(getProductCategoryLabel("health-equipment")).toBe("อุปกรณ์สุขภาพ");
    expect(getProductCategoryLabel("unknown")).toBe("สินค้าอื่น ๆ");
  });

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
        specialties: ["family_medicine"]
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
        role: "doctor",
        firstName: "สมชาย",
        lastName: "ใจดี",
        specialties: []
      }).success
    ).toBe(false);
    expect(
      staffInviteRequestSchema.safeParse({
        role: "doctor",
        firstName: "สมชาย",
        lastName: "ใจดี",
        specialties: ["other"],
        otherSpecialty: ""
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

  it("requires a per-render checkout request id for customer order creation", () => {
    expect(
      checkoutSchema.parse({
        checkoutRequestId: "f75c16fe-0f6a-4ce8-8a1a-2048fb1272da"
      }).checkoutRequestId
    ).toBe("f75c16fe-0f6a-4ce8-8a1a-2048fb1272da");
    expect(checkoutSchema.safeParse({ checkoutRequestId: "" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ checkoutRequestId: "not-a-uuid" }).success).toBe(false);
  });

  it("validates community article interactions without accepting empty sensitive context", () => {
    expect(articleIdSchema.safeParse("article-1").success).toBe(true);
    expect(articleIdSchema.safeParse("").success).toBe(false);
    expect(commentSchema.parse({ articleId: "article-1", body: "  Helpful note  " }).body).toBe("Helpful note");
    expect(commentSchema.safeParse({ articleId: "article-1", body: "" }).success).toBe(false);
    expect(
      reportContentSchema.parse({
        itemId: "comment-1",
        itemType: "comment",
        articleSlug: "vitamin-c-tips",
        reason: "privacy",
        details: "  Needs review  "
      }).details
    ).toBe("Needs review");
    expect(
      reportContentSchema.safeParse({
        itemId: "comment-1",
        itemType: "comment",
        articleSlug: "vitamin-c-tips",
        reason: "unknown"
      }).success
    ).toBe(false);
  });

  it("requires privacy acknowledgement for community posts", () => {
    const validPost = {
      title: "กิจวัตรดูแลตัวเอง",
      body: "แบ่งปันข้อมูลทั่วไปโดยไม่ระบุชื่อหรือข้อมูลสุขภาพที่ระบุตัวบุคคลได้",
      category: "การดูแลผิว",
      privacyAccepted: "on"
    };

    expect(communityPostSchema.safeParse(validPost).success).toBe(true);
    expect(communityPostSchema.safeParse({ ...validPost, privacyAccepted: undefined }).success).toBe(false);
    expect(communityPostSchema.safeParse({ ...validPost, body: "สั้นเกินไป" }).success).toBe(false);
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
