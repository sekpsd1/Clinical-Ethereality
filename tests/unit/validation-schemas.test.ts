import { describe, expect, it } from "vitest";
import { cartMutationSchema } from "@/features/cart/schema";
import { articleIdSchema, commentSchema, reportContentSchema } from "@/features/community/article/schema";
import { getLegalDocument, getRequiredLegalDocuments } from "@/features/legal/documents";
import { acceptConsentSchema } from "@/features/legal/schema";
import { checkoutSchema } from "@/features/products/checkout/schema";

describe("feature validation schemas", () => {
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
});
