import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreProductDetailItem, StoreProductListItem } from "@/features/products/types";

const prismaMock = vi.hoisted(() => ({
  product: {
    findMany: vi.fn(),
    findFirst: vi.fn()
  }
}));

vi.mock("next/cache", () => ({
  unstable_noStore: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock
}));

vi.mock("@/features/cart/actions", () => ({
  addToCartAction: vi.fn()
}));

vi.mock("@/features/products/prescriptions/actions", () => ({
  createExternalPrescriptionOrderAction: vi.fn()
}));

import { HealthMarketplace } from "@/features/products/HealthMarketplace";
import { ProductDetail } from "@/features/products/ProductDetail";
import { getStoreMarketplace, getStoreProductDetail } from "@/features/products/queries";

const storageReadiness = {
  provider: "not_configured" as const,
  isConfigured: false,
  canAcceptHostedUrl: true,
  publicBaseUrl: null,
  configuredKeys: [],
  missingKeys: ["Cloudinary credentials or S3 credentials"]
};

function createProduct(overrides: Partial<StoreProductDetailItem> = {}): StoreProductDetailItem {
  return {
    id: "product-1",
    name: "สินค้าจริงจากฐานข้อมูล",
    slug: "database-product",
    category: "health-equipment",
    categoryLabel: "อุปกรณ์สุขภาพ",
    price: "฿1,200",
    description: "รายละเอียดสินค้า",
    imageAlt: "สินค้าจริงจากฐานข้อมูล",
    imageUrl: null,
    media: "kit",
    href: "/store/database-product",
    cta: "ดูสินค้า",
    requiresPrescription: false,
    availableQuantity: 5,
    stockLabel: "พร้อมจัดส่ง",
    featured: false,
    longDescription: "รายละเอียดสินค้าจริง",
    usageInstructions: null,
    fdaNumber: null,
    warnings: null,
    storageInstructions: null,
    controlledOrRestricted: false,
    specialFulfillmentNotes: null,
    ...overrides
  };
}

function toListItem(product: StoreProductDetailItem): StoreProductListItem {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    category: product.category,
    categoryLabel: product.categoryLabel,
    price: product.price,
    description: product.description,
    imageAlt: product.imageAlt,
    imageUrl: product.imageUrl,
    media: product.media,
    href: product.href,
    cta: product.cta,
    requiresPrescription: product.requiresPrescription,
    availableQuantity: product.availableQuantity,
    stockLabel: product.stockLabel,
    featured: product.featured
  };
}

describe("store catalog query safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a true empty catalog instead of fallback products", async () => {
    prismaMock.product.findMany.mockResolvedValue([]);

    await expect(getStoreMarketplace()).resolves.toEqual({
      products: []
    });
  });

  it("marks database failures unavailable without inventing a product", async () => {
    prismaMock.product.findMany.mockRejectedValue(new Error("database unavailable"));
    prismaMock.product.findFirst.mockRejectedValue(new Error("database unavailable"));

    await expect(getStoreMarketplace()).resolves.toEqual({
      products: [],
      unavailable: true
    });
    await expect(getStoreProductDetail("missing-product")).resolves.toEqual({
      product: null,
      unavailable: true
    });
  });

  it("maps real available stock for product purchase decisions", async () => {
    prismaMock.product.findFirst.mockResolvedValue({
      id: "product-1",
      name: "สินค้าหมด",
      slug: "out-of-stock",
      category: "health-equipment",
      shortDescription: null,
      description: "รายละเอียด",
      usageInstructions: null,
      fdaNumber: null,
      warnings: null,
      storageInstructions: null,
      controlledOrRestricted: false,
      specialFulfillmentNotes: null,
      price: 1200,
      imageUrl: null,
      requiresPrescription: false,
      inventory: {
        quantity: 3,
        reservedQuantity: 3,
        lowStockThreshold: 1
      }
    });

    const data = await getStoreProductDetail("out-of-stock");

    expect(data.product?.availableQuantity).toBe(0);
    expect(data.product?.stockLabel).toBe("สินค้าหมด");
  });
});

describe("store catalog component safety", () => {
  it("renders distinct empty and error states without purchasable fallback products", () => {
    const emptyHtml = renderToStaticMarkup(<HealthMarketplace data={{ products: [] }} />);
    const errorHtml = renderToStaticMarkup(<HealthMarketplace data={{ products: [], unavailable: true }} />);

    expect(emptyHtml).toContain("ยังไม่มีสินค้าในแคตตาล็อก");
    expect(errorHtml).toContain("ไม่สามารถโหลดสินค้าได้");
    expect(emptyHtml).not.toContain("Antiviral Gel");
    expect(emptyHtml).not.toContain("paracetamol-500mg");
    expect(errorHtml).not.toContain("กำลังแสดงรายการสำรอง");
  });

  it("renders every product even when multiple prescription products are featured", () => {
    const products = [
      toListItem(createProduct({ id: "rx-1", name: "ยาตามใบสั่งแพทย์หนึ่ง", slug: "rx-one", href: "/store/rx-one", featured: true })),
      toListItem(createProduct({ id: "rx-2", name: "ยาตามใบสั่งแพทย์สอง", slug: "rx-two", href: "/store/rx-two", featured: true })),
      toListItem(createProduct({ id: "general-1", name: "สินค้าทั่วไป", slug: "general", href: "/store/general" }))
    ];

    const html = renderToStaticMarkup(<HealthMarketplace data={{ products }} />);

    expect(html).toContain("ยาตามใบสั่งแพทย์หนึ่ง");
    expect(html).toContain("ยาตามใบสั่งแพทย์สอง");
    expect(html).toContain("สินค้าทั่วไป");
  });

  it("does not render a purchase action for missing, unavailable, or out-of-stock products", () => {
    const missingHtml = renderToStaticMarkup(
      <ProductDetail data={{ product: null }} storageReadiness={storageReadiness} />
    );
    const unavailableHtml = renderToStaticMarkup(
      <ProductDetail data={{ product: null, unavailable: true }} storageReadiness={storageReadiness} />
    );
    const outOfStockHtml = renderToStaticMarkup(
      <ProductDetail
        data={{
          product: createProduct({
            availableQuantity: 0,
            stockLabel: "สินค้าหมด"
          })
        }}
        storageReadiness={storageReadiness}
      />
    );
    const outOfStockPrescriptionHtml = renderToStaticMarkup(
      <ProductDetail
        data={{
          product: createProduct({
            requiresPrescription: true,
            availableQuantity: 0,
            stockLabel: "สินค้าหมด"
          })
        }}
        storageReadiness={storageReadiness}
      />
    );

    expect(missingHtml).toContain("ไม่พบสินค้านี้");
    expect(unavailableHtml).toContain("ไม่สามารถโหลดรายละเอียดสินค้าได้");
    expect(missingHtml).not.toContain("เพิ่มลงตะกร้า");
    expect(unavailableHtml).not.toContain("เพิ่มลงตะกร้า");
    expect(outOfStockHtml).toContain("สินค้าหมดชั่วคราว");
    expect(outOfStockHtml).not.toContain("เพิ่มลงตะกร้า");
    expect(outOfStockPrescriptionHtml).toContain("ยังไม่สามารถสร้างคำสั่งซื้อพร้อมใบสั่งยาได้");
    expect(outOfStockPrescriptionHtml).not.toContain("Prescription file URL");
    expect(outOfStockPrescriptionHtml).not.toContain("ใช้ใบสั่งยาในระบบ");
  });

  it("does not expose static advice-log or dead share controls", () => {
    const html = renderToStaticMarkup(
      <ProductDetail data={{ product: createProduct() }} storageReadiness={storageReadiness} />
    );

    expect(html).not.toContain("Advice Log");
    expect(html).not.toContain("นพ. ธีรภัทร");
    expect(html).not.toContain("เปลี่ยนการเลือกใบสั่งยา");
    expect(html).not.toContain('aria-label="Share product"');
  });
});
