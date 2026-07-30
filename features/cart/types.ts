import type { StoreProductMedia } from "@/features/products/types";

export type CartItem = {
  slug: string;
  name: string;
  price: string;
  quantity: number;
  availableQuantity: number;
  lineTotal: string;
  requiresPrescription: boolean;
  media: StoreProductMedia;
  stockLabel: string;
};

export type StaleCartItem = {
  slug: string;
  quantity: number;
};

export type CartData = {
  items: CartItem[];
  staleItems: StaleCartItem[];
  itemCount: number;
  subtotalAmount: number;
  subtotal: string;
  unavailable?: boolean;
};
