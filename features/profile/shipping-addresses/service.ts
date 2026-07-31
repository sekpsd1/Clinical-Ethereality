import type { Prisma } from "@prisma/client";

export class ShippingAddressNotFoundError extends Error {}

export async function getOrderShippingAddressSnapshot(
  tx: Prisma.TransactionClient,
  userId: string,
  addressId: string
) {
  const address = await tx.shippingAddress.findFirst({
    where: { id: addressId, userId },
    select: {
      id: true,
      label: true,
      recipientName: true,
      phone: true,
      addressLine1: true,
      addressLine2: true,
      subdistrict: true,
      district: true,
      province: true,
      postalCode: true
    }
  });

  if (!address) {
    throw new ShippingAddressNotFoundError("Shipping address does not belong to this customer.");
  }

  const { id: sourceAddressId, ...snapshot } = address;
  return { sourceAddressId, ...snapshot };
}
