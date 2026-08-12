import type { ProductStatus } from "@prisma/client";
import type { ProductCategory } from "@/features/products/categories";

export type AdminInventoryItem = {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productCategory: ProductCategory;
  productCategoryLabel: string;
  productImageUrl: string;
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
