import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AdminInventoryData, AdminInventoryItem } from "@/features/admin/inventory/types";

vi.mock("@/features/admin/inventory/actions", () => ({
  updateInventoryAction: vi.fn()
}));

import { AdminInventory } from "@/features/admin/AdminInventory";
import { AdminProductTabs } from "@/features/admin/AdminProductTabs";
import {
  defaultAdminInventoryFilters,
  filterAdminInventoryItems,
  isTestInventoryItem
} from "@/features/admin/inventory/filters";

function createItem(overrides: Partial<AdminInventoryItem> = {}): AdminInventoryItem {
  return {
    id: "inventory-1",
    productId: "product-1",
    productName: "HPV Home Test Kit 29 สายพันธุ์",
    productSlug: "hpv-home-test-kit-29",
    productCategory: "health-equipment",
    productCategoryLabel: "อุปกรณ์สุขภาพ",
    productImageUrl: "/images/products/colli-pee.jpg",
    productStatus: "active",
    quantity: 20,
    reservedQuantity: 2,
    availableQuantity: 18,
    lowStockThreshold: 5,
    requiresPrescription: false,
    updatedAt: "13 ส.ค. 2569 10:00",
    ...overrides
  };
}

function createData(items: AdminInventoryItem[]): AdminInventoryData {
  return {
    items,
    summary: {
      activeProducts: items.filter((item) => item.productStatus === "active").length,
      lowStock: items.filter(
        (item) => item.productStatus === "active" && item.availableQuantity <= item.lowStockThreshold
      ).length,
      prescriptionItems: items.filter((item) => item.requiresPrescription).length
    }
  };
}

describe("admin inventory filters", () => {
  const realActive = createItem();
  const uatActive = createItem({
    id: "inventory-uat",
    productId: "product-uat",
    productName: "[UAT] Doctor-selected product",
    productSlug: "doctor-rx-browser-123"
  });
  const archived = createItem({
    id: "inventory-archived",
    productId: "product-archived",
    productName: "Vitamin C Complex",
    productSlug: "vitamin-c-complex",
    productStatus: "archived"
  });

  it("defaults to active real products without hiding approved Home Test products", () => {
    expect(isTestInventoryItem(realActive)).toBe(false);
    expect(isTestInventoryItem(uatActive)).toBe(true);
    expect(filterAdminInventoryItems([realActive, uatActive, archived], defaultAdminInventoryFilters)).toEqual([
      realActive
    ]);
  });

  it("reveals Test/UAT and archived records only through explicit filters", () => {
    expect(
      filterAdminInventoryItems([realActive, uatActive, archived], {
        ...defaultAdminInventoryFilters,
        includeTestItems: true
      })
    ).toEqual([realActive, uatActive]);

    expect(
      filterAdminInventoryItems([realActive, uatActive, archived], {
        ...defaultAdminInventoryFilters,
        status: "archived"
      })
    ).toEqual([archived]);
  });

  it("combines keyword, category, and low-stock filters", () => {
    const lowStock = createItem({
      id: "inventory-low",
      productId: "product-low",
      productName: "Self Swab Kit",
      productSlug: "self-swab-kit",
      availableQuantity: 3,
      lowStockThreshold: 5
    });

    expect(
      filterAdminInventoryItems([realActive, lowStock], {
        ...defaultAdminInventoryFilters,
        category: "health-equipment",
        query: "  self   swab ",
        stock: "low"
      })
    ).toEqual([lowStock]);
  });
});

describe("AdminInventory UX", () => {
  it("renders the unified product tabs, compact table, and mobile cards without inline stock forms", () => {
    const html = renderToStaticMarkup(
      <AdminInventory
        data={createData([
          createItem(),
          createItem({
            id: "inventory-uat",
            productId: "product-uat",
            productName: "[UAT] Hidden fixture",
            productSlug: "uat-hidden-fixture"
          }),
          createItem({
            id: "inventory-archived",
            productId: "product-archived",
            productName: "Archived Product",
            productSlug: "archived-product",
            productStatus: "archived"
          })
        ])}
      />
    );

    expect(html).toContain('href="/admin/products"');
    expect(html).toContain('href="/admin/inventory"');
    expect(html).toContain("แคตตาล็อกสินค้า");
    expect(html).toContain("สต็อกสินค้า");
    expect(html).toContain("คงคลัง");
    expect(html).toContain("พร้อมขาย");
    expect(html).toContain("HPV Home Test Kit 29 สายพันธุ์");
    expect(html).not.toContain("[UAT] Hidden fixture");
    expect(html).not.toContain("Archived Product");
    expect(html).not.toContain('name="quantity"');
  });

  it("marks the requested product-area tab as current", () => {
    const catalogHtml = renderToStaticMarkup(<AdminProductTabs active="catalog" />);
    const inventoryHtml = renderToStaticMarkup(<AdminProductTabs active="inventory" />);

    expect(catalogHtml).toMatch(/aria-current="page"[^>]+href="\/admin\/products"/);
    expect(inventoryHtml).toMatch(/aria-current="page"[^>]+href="\/admin\/inventory"/);
  });
});
