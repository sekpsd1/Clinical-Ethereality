import { describe, expect, it } from "vitest";
import type { CartData, CartItem } from "@/features/cart/types";
import {
  canReserveInventory,
  getStoreCheckoutBlockReason
} from "@/features/products/checkout/safety";

const baseItem: CartItem = {
  slug: "hpv-home-test-14",
  name: "HPV Home Test Kit",
  price: "1,200 บาท",
  quantity: 1,
  availableQuantity: 5,
  lineTotal: "1,200 บาท",
  requiresPrescription: false,
  media: "kit",
  stockLabel: "พร้อมจัดส่ง 5"
};

function cart(overrides: Partial<CartData> = {}): CartData {
  return {
    items: [baseItem],
    staleItems: [],
    itemCount: 1,
    subtotalAmount: 1200,
    subtotal: "1,200 บาท",
    ...overrides
  };
}

describe("store checkout safety", () => {
  it("blocks checkout when cart data is unavailable or empty", () => {
    expect(getStoreCheckoutBlockReason(cart({ unavailable: true }))).toBe("unavailable");
    expect(
      getStoreCheckoutBlockReason(
        cart({
          items: [],
          staleItems: [],
          itemCount: 0,
          subtotalAmount: 0,
          subtotal: "0 บาท"
        })
      )
    ).toBe("empty");
  });

  it("blocks stale cart entries before treating the visible cart as empty", () => {
    expect(
      getStoreCheckoutBlockReason(
        cart({
          items: [],
          staleItems: [{ slug: "archived-product", quantity: 2 }],
          itemCount: 0,
          subtotalAmount: 0,
          subtotal: "0 บาท"
        })
      )
    ).toBe("stale");
  });

  it("blocks prescription products and quantities above available stock", () => {
    expect(
      getStoreCheckoutBlockReason(
        cart({
          items: [{ ...baseItem, requiresPrescription: true }]
        })
      )
    ).toBe("prescription");
    expect(
      getStoreCheckoutBlockReason(
        cart({
          items: [{ ...baseItem, quantity: 6 }]
        })
      )
    ).toBe("stock");
  });

  it("allows only a non-prescription cart fully covered by current available stock", () => {
    expect(getStoreCheckoutBlockReason(cart())).toBeNull();
    expect(getStoreCheckoutBlockReason(cart(), { paymentAvailable: false })).toBe("payment");
    expect(canReserveInventory({ quantity: 10, reservedQuantity: 4 }, 6)).toBe(true);
    expect(canReserveInventory({ quantity: 10, reservedQuantity: 4 }, 7)).toBe(false);
    expect(canReserveInventory(null, 1)).toBe(false);
    expect(canReserveInventory({ quantity: 10, reservedQuantity: 0 }, 0)).toBe(false);
  });
});
