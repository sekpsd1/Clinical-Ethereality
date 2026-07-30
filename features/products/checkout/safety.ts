import type { CartData } from "@/features/cart/types";

export type StoreCheckoutBlockReason =
  | "unavailable"
  | "stale"
  | "empty"
  | "prescription"
  | "stock"
  | "payment";

type InventorySnapshot = {
  quantity: number;
  reservedQuantity: number;
} | null;

export function getStoreCheckoutBlockReason(
  cart: CartData,
  options: {
    paymentAvailable?: boolean;
  } = {}
): StoreCheckoutBlockReason | null {
  if (cart.unavailable) {
    return "unavailable";
  }

  if (cart.staleItems.length > 0) {
    return "stale";
  }

  if (cart.items.length === 0) {
    return "empty";
  }

  if (cart.items.some((item) => item.requiresPrescription)) {
    return "prescription";
  }

  if (cart.items.some((item) => item.availableQuantity < item.quantity)) {
    return "stock";
  }

  if (options.paymentAvailable === false) {
    return "payment";
  }

  return null;
}

export function canReserveInventory(inventory: InventorySnapshot, requestedQuantity: number): boolean {
  if (!inventory || !Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
    return false;
  }

  return inventory.quantity - inventory.reservedQuantity >= requestedQuantity;
}
