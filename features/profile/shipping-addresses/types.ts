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
  const isBangkok = address.province.trim() === "กรุงเทพมหานคร";
  return [
    address.addressLine1,
    address.addressLine2,
    `${isBangkok ? "แขวง" : "ตำบล"} ${address.subdistrict}`,
    `${isBangkok ? "เขต" : "อำเภอ"} ${address.district}`,
    address.province,
    address.postalCode
  ].filter(Boolean).join(" ");
}
