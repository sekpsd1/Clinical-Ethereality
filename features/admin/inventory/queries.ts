import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { AdminInventoryData, AdminInventoryItem } from "@/features/admin/inventory/types";

type InventoryWithProduct = Awaited<ReturnType<typeof getInventoryForAdmin>>[number];

function getInventoryForAdmin() {
  return prisma.inventory.findMany({
    orderBy: [
      {
        product: {
          name: "asc"
        }
      }
    ],
    include: {
      product: true
    }
  });
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function isLowStock(item: Pick<AdminInventoryItem, "availableQuantity" | "lowStockThreshold" | "productStatus">): boolean {
  return item.productStatus === "active" && item.availableQuantity <= item.lowStockThreshold;
}

function mapInventoryItem(item: InventoryWithProduct): AdminInventoryItem {
  const availableQuantity = Math.max(item.quantity - item.reservedQuantity, 0);

  return {
    id: item.id,
    productId: item.productId,
    productName: item.product.name,
    productSlug: item.product.slug,
    productStatus: item.product.status,
    quantity: item.quantity,
    reservedQuantity: item.reservedQuantity,
    availableQuantity,
    lowStockThreshold: item.lowStockThreshold,
    requiresPrescription: item.product.requiresPrescription,
    updatedAt: formatDate(item.updatedAt)
  };
}

export async function getAdminInventory(): Promise<AdminInventoryData> {
  noStore();

  try {
    const inventory = await getInventoryForAdmin();
    const items = inventory.map(mapInventoryItem);

    return {
      items,
      summary: {
        lowStock: items.filter(isLowStock).length,
        activeProducts: items.filter((item) => item.productStatus === "active").length,
        prescriptionItems: items.filter((item) => item.requiresPrescription).length
      }
    };
  } catch {
    return {
      items: [],
      summary: {
        lowStock: 0,
        activeProducts: 0,
        prescriptionItems: 0
      },
      unavailable: true
    };
  }
}
