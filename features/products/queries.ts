import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type {
  StoreMarketplaceData,
  StoreProductDetailData,
  StoreProductDetailItem,
  StoreProductListItem,
  StoreProductMedia
} from "@/features/products/types";

type ProductWithInventory = Awaited<ReturnType<typeof getActiveProducts>>[number];

function getActiveProducts() {
  return prisma.product.findMany({
    where: {
      status: "active"
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
  const available = Math.max((product.inventory?.quantity ?? 0) - (product.inventory?.reservedQuantity ?? 0), 0);

  if (available === 0) {
    return "สินค้าหมด";
  }

  if (available <= (product.inventory?.lowStockThreshold ?? 0)) {
    return `เหลือ ${available}`;
  }

  return "พร้อมจัดส่ง";
}

function getProductCta(product: ProductWithInventory): string {
  return product.requiresPrescription ? "ดูรายละเอียด" : "ดูสินค้า";
}

function mapProduct(product: ProductWithInventory, index: number): StoreProductListItem {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: formatMoney(product.price),
    description: product.description,
    imageAlt: product.name,
    media: getProductMedia(product),
    href: `/store/${product.slug}`,
    cta: getProductCta(product),
    requiresPrescription: product.requiresPrescription,
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
      "ผลิตภัณฑ์นี้อยู่ในแคตตาล็อก Clinical Ethereality และควรใช้งานตามคำแนะนำของทีมคลินิกหรือเภสัชกร"
  };
}

export async function getStoreMarketplace(): Promise<StoreMarketplaceData> {
  noStore();

  try {
    const products = await getActiveProducts();

    return {
      products: products.map(mapProduct)
    };
  } catch {
    return {
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
