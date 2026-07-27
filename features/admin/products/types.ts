import type { ProductStatus } from "@prisma/client";
import type { ProductCategory } from "@/features/products/categories";

export type AdminProductItem = {
  id: string;
  name: string;
  slug: string;
  category: ProductCategory;
  categoryLabel: string;
  shortDescription: string;
  description: string;
  usageInstructions: string;
  fdaNumber: string;
  warnings: string;
  storageInstructions: string;
  controlledOrRestricted: boolean;
  specialFulfillmentNotes: string;
  imageUrl: string;
  price: string;
  status: ProductStatus;
  requiresPrescription: boolean;
  inventoryQuantity: number | null;
  updatedAt: string;
};

export type AdminProductsData = {
  products: AdminProductItem[];
  summary: {
    active: number;
    draft: number;
    prescriptionRequired: number;
  };
  unavailable?: boolean;
};
