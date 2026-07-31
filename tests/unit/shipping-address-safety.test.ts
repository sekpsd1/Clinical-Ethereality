import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { shippingAddressFormSchema } from "@/features/profile/shipping-addresses/schema";
import { getOrderShippingAddressSnapshot, ShippingAddressNotFoundError } from "@/features/profile/shipping-addresses/service";

const address = {
  id: "address-1",
  label: "บ้าน",
  recipientName: "Customer One",
  phone: "0812345678",
  addressLine1: "1 ถนนสุขุมวิท",
  addressLine2: null,
  subdistrict: "คลองเตย",
  district: "คลองเตย",
  province: "กรุงเทพมหานคร",
  postalCode: "10110"
};

describe("shipping address safety", () => {
  it("validates a complete Thai shipping address and normalizes an empty second line", () => {
    const parsed = shippingAddressFormSchema.parse({ ...address, addressLine2: "", isDefault: "on" });
    expect(parsed.addressLine2).toBeUndefined();
    expect(parsed.isDefault).toBe(true);
    expect(shippingAddressFormSchema.safeParse({ ...address, postalCode: "1011", isDefault: false }).success).toBe(false);
  });

  it("reads only an address owned by the customer and returns snapshot values", async () => {
    const findFirst = vi.fn().mockResolvedValue(address);
    const tx = { shippingAddress: { findFirst } } as unknown as Prisma.TransactionClient;
    const snapshot = await getOrderShippingAddressSnapshot(tx, "customer-1", "address-1");

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "address-1", userId: "customer-1" } }));
    expect(snapshot).toEqual({ sourceAddressId: "address-1", label: "บ้าน", recipientName: "Customer One", phone: "0812345678", addressLine1: "1 ถนนสุขุมวิท", addressLine2: null, subdistrict: "คลองเตย", district: "คลองเตย", province: "กรุงเทพมหานคร", postalCode: "10110" });
    expect(snapshot).not.toHaveProperty("id");
  });

  it("rejects an address outside the logged-in customer account", async () => {
    const tx = { shippingAddress: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as Prisma.TransactionClient;
    await expect(getOrderShippingAddressSnapshot(tx, "customer-1", "address-other")).rejects.toBeInstanceOf(ShippingAddressNotFoundError);
  });
});
