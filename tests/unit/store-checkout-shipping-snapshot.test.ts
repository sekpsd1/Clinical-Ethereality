import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  redirect: vi.fn((href: string) => { throw new Error(`REDIRECT:${href}`); }),
  cookieDelete: vi.fn(),
  getSnapshot: vi.fn(),
  writeAuditLog: vi.fn()
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn().mockResolvedValue({ delete: mocks.cookieDelete }) }));
vi.mock("@/lib/auth/session", () => ({ requireCurrentSession: vi.fn().mockResolvedValue({ userId: "customer-1", role: "customer", permissions: ["order:create:self"] }) }));
vi.mock("@/lib/permissions", () => ({ assertPermission: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/audit/audit-log", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/features/cart/cookies", () => ({ CART_COOKIE_NAME: "cart", parseCartCookie: vi.fn().mockReturnValue([{ slug: "vitamin", quantity: 2 }]) }));
vi.mock("@/features/products/checkout/idempotency", () => ({ canReuseCheckoutOrder: vi.fn(), createCartFingerprint: vi.fn().mockReturnValue("fingerprint"), findExistingCheckoutOrder: vi.fn().mockResolvedValue(null) }));
vi.mock("@/features/products/checkout/payment", () => ({ createStorePromptPayPayload: vi.fn().mockReturnValue("qr") }));
vi.mock("@/features/products/checkout/safety", () => ({ canReserveInventory: vi.fn().mockReturnValue(true) }));
vi.mock("@/features/orders/reservations", () => ({ assertStorePendingOrderCapacity: vi.fn(), releaseExpiredStoreOrderReservations: vi.fn(), StorePendingOrderLimitError: class StorePendingOrderLimitError extends Error {} }));
vi.mock("@/features/profile/shipping-addresses/service", () => ({
  getOrderShippingAddressSnapshot: mocks.getSnapshot,
  ShippingAddressNotFoundError: class ShippingAddressNotFoundError extends Error {}
}));

import { createStoreCheckoutOrderAction } from "@/features/products/checkout/actions";

describe("store checkout shipping snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSnapshot.mockResolvedValue({ sourceAddressId: "address-1", label: "บ้าน", recipientName: "Customer", phone: "0812345678", addressLine1: "1 Main Road", addressLine2: null, subdistrict: "คลองเตย", district: "คลองเตย", province: "กรุงเทพมหานคร", postalCode: "10110" });
  });

  it("checks address ownership and creates the order with an immutable snapshot in one transaction", async () => {
    const product = { id: "product-1", slug: "vitamin", price: new Prisma.Decimal(100), requiresPrescription: false, inventory: { id: "inventory-1", quantity: 10, reservedQuantity: 0 } };
    const tx = {
      product: { findMany: vi.fn().mockResolvedValue([product]) },
      inventory: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      order: { create: vi.fn().mockResolvedValue({ id: "order-1" }) },
      notification: { create: vi.fn().mockResolvedValue({ id: "notification-1" }) }
    };
    mocks.transaction.mockImplementation(async (operation) => operation(tx));
    const form = new FormData();
    form.set("checkoutRequestId", "f75c16fe-0f6a-4ce8-8a1a-2048fb1272da");
    form.set("shippingAddressId", "address-1");

    await expect(createStoreCheckoutOrderAction(form)).rejects.toThrow("REDIRECT:/store/orders?created=order-1");
    expect(mocks.getSnapshot).toHaveBeenCalledWith(tx, "customer-1", "address-1");
    expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ shippingAddress: { create: expect.objectContaining({ sourceAddressId: "address-1", postalCode: "10110" }) } }) }));
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });
});
