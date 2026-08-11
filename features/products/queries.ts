import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getProductCategoryLabel } from "@/features/products/categories";
import type { StoreMarketplaceFilters } from "@/features/products/search";
import type {
  StoreMarketplaceData,
  StoreProductDetailData,
  StoreProductDetailItem,
  StoreProductListItem,
  StoreProductMedia
} from "@/features/products/types";

type ProductWithInventory = Awaited<ReturnType<typeof getActiveProducts>>[number];

function getActiveProducts(filters: StoreMarketplaceFilters) {
  return prisma.product.findMany({
    where: {
      status: "active",
      ...(filters.category
        ? {
            category: filters.category
          }
        : {}),
      ...(filters.query
        ? {
            OR: [
              {
                name: {
                  contains: filters.query
                }
              },
              {
                shortDescription: {
                  contains: filters.query
                }
              },
              {
                description: {
                  contains: filters.query
                }
              }
            ]
          }
        : {})
    },
    orderBy: [
      {
        requiresPrescription: "desc"
      },
      {
        updatedAt: "desc"
      }
    ],
    include: {
      inventory: true
    }
  });
}

function getActiveProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: {
      slug,
      status: "active"
    },
    include: {
      inventory: true
    }
  });
}

function formatMoney(value: unknown): string {
  return new Intl.NumberFormat("th-TH", {
    currency: "THB",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(Number(value));
}

function getProductMedia(product: Pick<ProductWithInventory, "slug" | "requiresPrescription">): StoreProductMedia {
  if (product.requiresPrescription) {
    return "gel";
  }

  if (product.slug.includes("vitamin")) {
    return "vitamin";
  }

  return "kit";
}

function getStockLabel(product: ProductWithInventory): string {
  const available = getAvailableQuantity(product);

  if (available === 0) {
    return "สินค้าหมด";
  }

  if (available <= (product.inventory?.lowStockThreshold ?? 0)) {
    return `เหลือ ${available}`;
  }

  return "พร้อมจัดส่ง";
}

function getAvailableQuantity(product: ProductWithInventory): number {
  return Math.max((product.inventory?.quantity ?? 0) - (product.inventory?.reservedQuantity ?? 0), 0);
}

function getProductCta(product: ProductWithInventory): string {
  return product.requiresPrescription ? "ดูรายละเอียด" : "ดูสินค้า";
}

function mapProduct(product: ProductWithInventory, index: number): StoreProductListItem {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    category: product.category,
    categoryLabel: getProductCategoryLabel(product.category),
    price: formatMoney(product.price),
    description: product.shortDescription ?? product.description,
    imageAlt: product.name,
    imageUrl: product.imageUrl,
    media: getProductMedia(product),
    href: `/store/${product.slug}`,
    cta: getProductCta(product),
    requiresPrescription: product.requiresPrescription,
    availableQuantity: getAvailableQuantity(product),
    stockLabel: getStockLabel(product),
    featured: index === 0 || product.requiresPrescription
  };
}

function mapProductDetail(product: ProductWithInventory): StoreProductDetailItem {
  const mapped = mapProduct(product, 0);

  return {
    ...mapped,
    featured: false,
    longDescription:
      product.description ??
      "ผลิตภัณฑ์นี้อยู่ในแคตตาล็อก Clinical Ethereality และควรใช้งานตามคำแนะนำของทีมคลินิกหรือเภสัชกร",
    usageInstructions: product.usageInstructions,
    fdaNumber: product.fdaNumber,
    warnings: product.warnings,
    storageInstructions: product.storageInstructions,
    controlledOrRestricted: product.controlledOrRestricted,
    specialFulfillmentNotes: product.specialFulfillmentNotes
  };
}

export async function getStoreMarketplace(filters: StoreMarketplaceFilters): Promise<StoreMarketplaceData> {
  noStore();

  try {
    const products = await getActiveProducts(filters);

    return {
      category: filters.category,
      query: filters.query,
      products: products.map(mapProduct)
    };
  } catch {
    return {
      category: filters.category,
      query: filters.query,
      products: [],
      unavailable: true
    };
  }
}

export async function getStoreProductDetail(slug: string): Promise<StoreProductDetailData> {
  noStore();

  try {
    const product = await getActiveProductBySlug(slug);

    return {
      product: product ? mapProductDetail(product) : null
    };
  } catch {
    return {
      product: null,
      unavailable: true
    };
  }
}
