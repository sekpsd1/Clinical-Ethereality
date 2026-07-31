export type ShippingAddressView = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
  isDefault: boolean;
};

export type OrderShippingAddressView = Omit<ShippingAddressView, "id" | "isDefault">;

export function formatShippingAddress(address: OrderShippingAddressView): string {
  return [
    address.addressLine1,
    address.addressLine2,
    `แขวง/ตำบล ${address.subdistrict}`,
    `เขต/อำเภอ ${address.district}`,
    address.province,
    address.postalCode
  ].filter(Boolean).join(" ");
}
