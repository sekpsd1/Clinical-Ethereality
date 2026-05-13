import type { StoreProductMedia } from "@/features/products/types";

export type CartItem = {
  slug: string;
  name: string;
  price: string;
  quantity: number;
  lineTotal: string;
  requiresPrescription: boolean;
  media: StoreProductMedia;
  stockLabel: string;
};

export type CartData = {
  items: CartItem[];
  itemCount: number;
  subtotal: string;
  unavailable?: boolean;
};
