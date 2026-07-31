import Link from "next/link";
import { MapPin } from "lucide-react";
import type { ShippingAddressView } from "@/features/profile/shipping-addresses/types";
import { formatShippingAddress } from "@/features/profile/shipping-addresses/types";

export function ShippingAddressSelector({ addresses, name = "shippingAddressId", returnTo }: { addresses: ShippingAddressView[]; name?: string; returnTo: string }) {
  if (addresses.length === 0) {
    return (
      <section className="rounded-[20px] border border-primary/20 bg-white/75 p-5 text-center">
        <MapPin aria-hidden="true" className="mx-auto size-6 text-primary" />
        <h2 className="mt-3 text-sm font-extrabold text-[#191c1e]">กรุณาเพิ่มที่อยู่จัดส่ง</h2>
        <p className="mt-1 text-xs leading-5 text-[#6e797a]">ต้องมีที่อยู่ก่อนจึงจะสร้างคำสั่งซื้อได้</p>
        <Link href={`/profile/shipping-addresses?returnTo=${encodeURIComponent(returnTo)}&new=1`} className="mt-4 inline-flex text-sm font-bold text-primary underline-offset-4 hover:underline">เพิ่มที่อยู่จัดส่ง</Link>
      </section>
    );
  }

  return (
    <fieldset className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <legend className="text-sm font-extrabold text-primary">ที่อยู่จัดส่ง</legend>
        <Link href={`/profile/shipping-addresses?returnTo=${encodeURIComponent(returnTo)}`} className="text-xs font-bold text-primary underline-offset-4 hover:underline">จัดการที่อยู่</Link>
      </div>
      {addresses.map((address) => (
        <label key={address.id} className="flex cursor-pointer gap-3 rounded-[18px] border border-primary/15 bg-white/75 p-4">
          <input required type="radio" name={name} value={address.id} defaultChecked={address.isDefault} className="mt-1 size-4 accent-primary" />
          <span className="min-w-0 text-left">
            <span className="block text-sm font-extrabold text-[#191c1e]">{address.label}{address.isDefault ? " · ค่าเริ่มต้น" : ""}</span>
            <span className="mt-1 block text-xs font-semibold text-[#3e494a]">{address.recipientName} · {address.phone}</span>
            <span className="mt-1 block text-xs leading-5 text-[#6e797a]">{formatShippingAddress(address)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
