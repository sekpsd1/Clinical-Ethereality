import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminProductItem, AdminProductsData } from "@/features/admin/products/types";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  productUpdate: vi.fn(),
  requireAdminSession: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdminSession: mocks.requireAdminSession
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog
}));

import { AdminProducts } from "@/features/admin/AdminProducts";
import { archiveProductAction } from "@/features/admin/products/actions";

function createProduct(overrides: Partial<AdminProductItem> = {}): AdminProductItem {
  return {
    id: "product-1",
    name: "HPV Self-Swab Kit",
    slug: "hpv-self-swab-kit",
    category: "health-equipment",
    categoryLabel: "อุปกรณ์สุขภาพ",
    shortDescription: "ชุดเก็บตัวอย่างด้วยตนเอง",
    description: "รายละเอียดสินค้า",
    usageInstructions: "",
    fdaNumber: "",
    warnings: "",
    storageInstructions: "",
    controlledOrRestricted: false,
    specialFulfillmentNotes: "",
    imageUrl: "/images/products/self-swab.png",
    price: "1490.00",
    status: "active",
    requiresPrescription: false,
    inventoryAvailableQuantity: 8,
    inventoryLowStockThreshold: 2,
    updatedAt: "13 ส.ค. 2569 10:00",
    ...overrides
  };
}

function createData(products: AdminProductItem[]): AdminProductsData {
  return {
    products,
    summary: {
      active: products.filter((product) => product.status === "active").length,
      draft: products.filter((product) => product.status === "draft").length,
      prescriptionRequired: products.filter((product) => product.requiresPrescription).length
    }
  };
}

describe("AdminProducts catalog UX", () => {
  it("groups the image-led catalog by category without rendering a form for every card", () => {
    const html = renderToStaticMarkup(
      <AdminProducts
        data={createData([
          createProduct(),
          createProduct({
            id: "product-2",
            name: "Calm Skin Gel",
            slug: "calm-skin-gel",
            category: "skincare",
            categoryLabel: "ดูแลผิวและสกินแคร์",
            imageUrl: "",
            inventoryAvailableQuantity: 0,
            status: "draft"
          })
        ])}
      />
    );

    expect(html).toContain("อุปกรณ์สุขภาพ");
    expect(html).toContain("ดูแลผิวและสกินแคร์");
    expect(html).toContain('alt="HPV Self-Swab Kit"');
    expect(html).toContain("สต็อก 8");
    expect(html).toContain("หมดสต็อก");
    expect(html).toContain('aria-label="แก้ไข HPV Self-Swab Kit"');
    expect(html).not.toContain('name="slug"');
  });

  it("does not offer archive again for an already archived product", () => {
    const html = renderToStaticMarkup(
      <AdminProducts data={createData([createProduct({ status: "archived" })])} />
    );

    expect(html).toContain("เก็บถาวร");
    expect(html).not.toContain('aria-label="เก็บถาวร HPV Self-Swab Kit"');
  });
});

describe("archiveProductAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) =>
      callback({
        product: {
          findUnique: mocks.findUnique,
          update: mocks.productUpdate
        }
      })
    );
    mocks.findUnique.mockResolvedValue({ id: "product-1", slug: "hpv-self-swab-kit", status: "active" });
    mocks.productUpdate.mockResolvedValue({});
  });

  it("changes only the product status and records an audit entry", async () => {
    const formData = new FormData();
    formData.set("productId", "product-1");

    const result = await archiveProductAction({ status: "idle", message: "" }, formData);

    expect(result).toEqual({ status: "success", message: "เก็บสินค้าถาวรแล้ว" });
    expect(mocks.productUpdate).toHaveBeenCalledWith({
      where: { id: "product-1" },
      data: { status: "archived" }
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: "admin-1",
        action: "product.archive",
        entityType: "product",
        entityId: "product-1"
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/products");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/store");
  });

  it("does not start a transaction when the admin guard rejects the caller", async () => {
    mocks.requireAdminSession.mockRejectedValueOnce(new Error("Admin access required."));
    const formData = new FormData();
    formData.set("productId", "product-1");

    await expect(archiveProductAction({ status: "idle", message: "" }, formData)).rejects.toThrow(
      "Admin access required."
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
