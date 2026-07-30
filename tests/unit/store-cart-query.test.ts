import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  productFindMany: vi.fn()
}));

vi.mock("next/cache", () => ({
  unstable_noStore: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    product: {
      findMany: mocks.productFindMany
    }
  }
}));

import { getCustomerCart } from "@/features/cart/queries";

function setCartCookie(items: Array<{ slug: string; quantity: number }>) {
  const value = encodeURIComponent(JSON.stringify(items));

  mocks.cookies.mockResolvedValue({
    get: (name: string) => (name === "ce_cart" ? { value } : undefined)
  });
}

describe("customer cart query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns inactive or missing cookie entries as explicit stale items", async () => {
    setCartCookie([
      { slug: "active-product", quantity: 1 },
      { slug: "archived-product", quantity: 2 }
    ]);
    mocks.productFindMany.mockResolvedValue([
      {
        slug: "active-product",
        name: "Active product",
        price: new Prisma.Decimal(450),
        requiresPrescription: false,
        inventory: {
          quantity: 5,
          reservedQuantity: 1
        }
      }
    ]);

    const cart = await getCustomerCart();

    expect(cart.items).toHaveLength(1);
    expect(cart.staleItems).toEqual([
      {
        slug: "archived-product",
        quantity: 2
      }
    ]);
    expect(cart.itemCount).toBe(1);
    expect(cart.subtotalAmount).toBe(450);
  });

  it("returns an empty stale-item list when the cookie is empty", async () => {
    mocks.cookies.mockResolvedValue({
      get: () => undefined
    });

    await expect(getCustomerCart()).resolves.toMatchObject({
      items: [],
      staleItems: [],
      itemCount: 0
    });
    expect(mocks.productFindMany).not.toHaveBeenCalled();
  });
});
