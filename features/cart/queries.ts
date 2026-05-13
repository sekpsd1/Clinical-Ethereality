import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { parseCartCookie } from "@/features/cart/cookies";
import type { CartData, CartItem } from "@/features/cart/types";
import type { StoreProductMedia } from "@/features/products/types";

type ProductWithInventory = Awaited<ReturnType<typeof getCartProducts>>[number];

function getCartProducts(slugs: string[]) {
  return prisma.product.findMany({
    where: {
      slug: {
        in: slugs
      },
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

  return `พร้อมจัดส่ง ${available}`;
}

function mapCartItem(product: ProductWithInventory, quantity: number): CartItem {
  const lineTotal = product.price.mul(quantity);

  return {
    slug: product.slug,
    name: product.name,
    price: formatMoney(product.price),
    quantity,
    lineTotal: formatMoney(lineTotal),
    requiresPrescription: product.requiresPrescription,
    media: getProductMedia(product),
    stockLabel: getStockLabel(product)
  };
}

export async function getCustomerCart(): Promise<CartData> {
  noStore();

  const cookieItems = parseCartCookie(await cookies());

  if (cookieItems.length === 0) {
    return {
      items: [],
      itemCount: 0,
      subtotalAmount: 0,
      subtotal: formatMoney(0)
    };
  }

  try {
    const products = await getCartProducts(cookieItems.map((item) => item.slug));
    const items = cookieItems
      .map((cookieItem) => {
        const product = products.find((candidate) => candidate.slug === cookieItem.slug);

        return product ? mapCartItem(product, cookieItem.quantity) : null;
      })
      .filter((item): item is CartItem => Boolean(item));
    const subtotal = items.reduce((total, item) => {
      const product = products.find((candidate) => candidate.slug === item.slug);

      return product ? total.add(product.price.mul(item.quantity)) : total;
    }, new Prisma.Decimal(0));

    return {
      items,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      subtotalAmount: Number(subtotal),
      subtotal: formatMoney(subtotal)
    };
  } catch {
    return {
      items: [],
      itemCount: 0,
      subtotalAmount: 0,
      subtotal: formatMoney(0),
      unavailable: true
    };
  }
}
