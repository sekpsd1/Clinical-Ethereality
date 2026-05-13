import type { ProductStatus } from "@prisma/client";

export type AdminInventoryItem = {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productStatus: ProductStatus;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  requiresPrescription: boolean;
  updatedAt: string;
};

export type AdminInventoryData = {
  items: AdminInventoryItem[];
  summary: {
    lowStock: number;
    activeProducts: number;
    prescriptionItems: number;
  };
  unavailable?: boolean;
};
