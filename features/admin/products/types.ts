import type { ProductStatus } from "@prisma/client";

export type AdminProductItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
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
