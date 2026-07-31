import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Home, MapPin, Plus, ShieldCheck, Truck } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { setDefaultShippingAddressAction } from "@/features/profile/shipping-addresses/actions";
import { ShippingAddressForm } from "@/features/profile/shipping-addresses/ShippingAddressForm";
import { formatShippingAddress, type ShippingAddressView } from "@/features/profile/shipping-addresses/types";

export function ShippingAddresses({ addresses, editingAddress, showForm, returnTo }: { addresses: ShippingAddressView[]; editingAddress?: ShippingAddressView; showForm: boolean; returnTo?: string }) {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[linear-gradient(180deg,#e0f2f1_0%,#f7f9fb_52%,#eef3f4_100%)] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <Header />
      <main className="mx-auto w-full max-w-mobile px-6 pt-8">
        <section className="rounded-[28px] border border-white/40 bg-white/70 p-6 shadow-[0_12px_40px_rgba(0,96,103,0.08)] backdrop-blur-[24px]">
          <div className="mb-5 flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg"><Truck aria-hidden="true" className="size-7" strokeWidth={2.25} /></span>
            <div><h1 className="text-[24px] font-extrabold leading-7 text-primary">ที่อยู่จัดส่ง</h1><p className="mt-1 text-sm text-[#3e494a]">จัดการที่อยู่สำหรับคำสั่งซื้อและการจัดส่งจากร้านยา</p></div>
          </div>
          <Link href="/profile/shipping-addresses?new=1" className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-primary/20 bg-white/70 text-sm font-bold text-primary shadow-sm active:scale-[0.99]"><Plus aria-hidden="true" className="size-4" />เพิ่มที่อยู่ใหม่</Link>
          {showForm ? <ShippingAddressForm address={editingAddress} /> : null}
        </section>
        <section className="mt-8 space-y-4">
          {addresses.length === 0 ? <EmptyState title="ยังไม่มีที่อยู่จัดส่ง" body="เพิ่มที่อยู่ก่อนสร้างคำสั่งซื้อ" icon={<MapPin aria-hidden="true" className="size-5" />} /> : addresses.map((address) => <AddressCard key={address.id} address={address} />)}
        </section>
        {returnTo ? <Link href={returnTo as Route} className="mt-6 flex h-12 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">กลับไปเลือกที่อยู่ในคำสั่งซื้อ</Link> : null}
      </main>
    </div>
  );
}

function Header() {
  return <header className="sticky top-0 z-header bg-white/70 shadow-[0_0_40px_rgba(0,123,131,0.06)] backdrop-blur-[24px]"><div className="mx-auto flex h-[82px] w-full max-w-mobile items-center gap-4 px-7"><Link href="/profile" aria-label="กลับไปหน้าโปรไฟล์" className="flex size-10 items-center justify-center rounded-full text-primary"><ArrowLeft aria-hidden="true" className="size-6" strokeWidth={2.4} /></Link><div className="min-w-0"><p className="text-[22px] font-bold tracking-wide text-primary">ที่อยู่จัดส่ง</p><p className="truncate text-xs font-medium uppercase tracking-[0.14em] text-[#3e494a]/60">ข้อมูลการจัดส่ง</p></div></div></header>;
}

function AddressCard({ address }: { address: ShippingAddressView }) {
  return (
    <article className="rounded-[24px] border border-white/50 bg-white/75 p-5 shadow-[0_10px_30px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="mb-4 flex items-start gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#e8fbf7] text-primary"><Home aria-hidden="true" className="size-6" strokeWidth={2.25} /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="truncate text-base font-extrabold text-[#191c1e]">{address.label}</h2>{address.isDefault ? <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">ค่าเริ่มต้น</span> : null}</div><p className="mt-2 text-sm font-semibold text-[#3e494a]">{address.recipientName}</p><p className="mt-1 text-sm text-[#3e494a]/75">{address.phone}</p></div></div>
      <div className="rounded-[18px] bg-[#f7f9fb] p-4"><div className="flex gap-3"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><p className="text-sm leading-6 text-[#3e494a]">{formatShippingAddress(address)}</p></div><div className="mt-3 flex gap-3"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><p className="text-xs leading-5 text-[#6e797a]">ระบบจะคัดลอกข้อมูลนี้เป็น snapshot เมื่อสร้างคำสั่งซื้อ</p></div></div>
      <div className="mt-4 flex gap-3"><Link href={`/profile/shipping-addresses?edit=${address.id}`} className="flex h-10 flex-1 items-center justify-center rounded-full border border-primary/20 text-xs font-bold text-primary">แก้ไข</Link>{!address.isDefault ? <form action={setDefaultShippingAddressAction} className="flex-1"><input type="hidden" name="addressId" value={address.id} /><button type="submit" className="h-10 w-full rounded-full bg-primary/10 text-xs font-bold text-primary">ตั้งเป็นค่าเริ่มต้น</button></form> : null}</div>
    </article>
  );
}
