import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { AdminProductItem, AdminProductsData } from "@/features/admin/products/types";
import { getProductCategoryLabel, productCategories, type ProductCategory } from "@/features/products/categories";

type ProductWithInventory = Awaited<ReturnType<typeof getProductsForAdmin>>[number];

function getProductsForAdmin() {
  return prisma.product.findMany({
    orderBy: {
      updatedAt: "desc"
    },
    include: {
      inventory: true
    }
  });
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatPrice(value: unknown): string {
  return Number(value).toFixed(2);
}

function mapProduct(product: ProductWithInventory): AdminProductItem {
  const category = productCategories.some((item) => item.value === product.category)
    ? (product.category as ProductCategory)
    : "other";

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    category,
    categoryLabel: getProductCategoryLabel(category),
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    usageInstructions: product.usageInstructions ?? "",
    fdaNumber: product.fdaNumber ?? "",
    warnings: product.warnings ?? "",
    storageInstructions: product.storageInstructions ?? "",
    controlledOrRestricted: product.controlledOrRestricted,
    specialFulfillmentNotes: product.specialFulfillmentNotes ?? "",
    imageUrl: product.imageUrl ?? "",
    price: formatPrice(product.price),
    status: product.status,
    requiresPrescription: product.requiresPrescription,
    inventoryAvailableQuantity: product.inventory
      ? Math.max(product.inventory.quantity - product.inventory.reservedQuantity, 0)
      : null,
    inventoryLowStockThreshold: product.inventory?.lowStockThreshold ?? null,
    updatedAt: formatDate(product.updatedAt)
  };
}

export async function getAdminProducts(): Promise<AdminProductsData> {
  noStore();

  try {
    const products = (await getProductsForAdmin()).map(mapProduct);

    return {
      products,
      summary: {
        active: products.filter((product) => product.status === "active").length,
        draft: products.filter((product) => product.status === "draft").length,
        prescriptionRequired: products.filter((product) => product.requiresPrescription).length
      }
    };
  } catch {
    return {
      products: [],
      summary: {
        active: 0,
        draft: 0,
        prescriptionRequired: 0
      },
      unavailable: true
    };
  }
}
