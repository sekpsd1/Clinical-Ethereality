import type { ProductStatus } from "@prisma/client";
import type { ProductCategory } from "@/features/products/categories";
import type { AdminInventoryItem } from "@/features/admin/inventory/types";

export type InventoryStatusFilter = ProductStatus | "all";
export type InventoryStockFilter = "all" | "available" | "low" | "out";

export type AdminInventoryFilters = {
  category: ProductCategory | "";
  includeTestItems: boolean;
  query: string;
  status: InventoryStatusFilter;
  stock: InventoryStockFilter;
};

export const defaultAdminInventoryFilters: AdminInventoryFilters = {
  category: "",
  includeTestItems: false,
  query: "",
  status: "active",
  stock: "all"
};

export function isTestInventoryItem(item: Pick<AdminInventoryItem, "productName" | "productSlug">): boolean {
  const name = item.productName.trim().toLowerCase();
  const slug = item.productSlug.trim().toLowerCase();

  return (
    name.includes("[uat]") ||
    name.includes("[test]") ||
    name.startsWith("uat-") ||
    name.startsWith("local ") ||
    /\buat\b/.test(name) ||
    slug.startsWith("uat-") ||
    slug.startsWith("test-") ||
    slug.includes("-uat-") ||
    slug.includes("browser-")
  );
}

export function isLowStockInventoryItem(
  item: Pick<AdminInventoryItem, "availableQuantity" | "lowStockThreshold" | "productStatus">
): boolean {
  return item.productStatus === "active" && item.availableQuantity <= item.lowStockThreshold;
}

export function filterAdminInventoryItems(
  items: AdminInventoryItem[],
  filters: AdminInventoryFilters
): AdminInventoryItem[] {
  const normalizedQuery = filters.query.trim().replace(/\s+/g, " ").toLocaleLowerCase("th-TH");

  return items.filter((item) => {
    if (!filters.includeTestItems && isTestInventoryItem(item)) {
      return false;
    }

    if (filters.status !== "all" && item.productStatus !== filters.status) {
      return false;
    }

    if (filters.category && item.productCategory !== filters.category) {
      return false;
    }

    if (normalizedQuery) {
      const searchableText = `${item.productName} ${item.productSlug}`.toLocaleLowerCase("th-TH");

      if (!searchableText.includes(normalizedQuery)) {
        return false;
      }
    }

    if (filters.stock === "low" && !isLowStockInventoryItem(item)) {
      return false;
    }

    if (filters.stock === "out" && item.availableQuantity > 0) {
      return false;
    }

    if (filters.stock === "available" && item.availableQuantity <= 0) {
      return false;
    }

    return true;
  });
}
