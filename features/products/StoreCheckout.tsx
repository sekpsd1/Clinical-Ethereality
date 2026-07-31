import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { createStoreCheckoutOrderAction } from "@/features/products/checkout/actions";
import { StoreCheckoutSubmit } from "@/features/products/checkout/StoreCheckoutSubmit";
import {
  getStoreCheckoutBlockReason,
  type StoreCheckoutBlockReason
} from "@/features/products/checkout/safety";
import type { CartData, CartItem, StaleCartItem } from "@/features/cart/types";
import { ShippingAddressSelector } from "@/features/profile/shipping-addresses/ShippingAddressSelector";
import type { ShippingAddressView } from "@/features/profile/shipping-addresses/types";

type CheckoutItem = {
  slug: string;
  name: string;
  pack: string;
  price: string;
  quantity: string;
  media: "paracetamol" | "amoxicillin";
  requiresPrescription: boolean;
};

const checkoutStatusMessages: Record<string, string> = {
  empty: "ตะกร้าว่าง กรุณาเลือกสินค้าก่อนสร้างคำสั่งซื้อ",
  failed: "ไม่สามารถสร้างคำสั่งซื้อได้ กรุณาตรวจสอบสินค้าและลองอีกครั้ง",
  invalid: "ข้อมูลคำสั่งซื้อไม่ถูกต้อง กรุณากลับไปที่ตะกร้าแล้วลองอีกครั้ง",
  stale: "มีสินค้าในตะกร้าที่ถูกปิดขายหรือไม่มีอยู่แล้ว ระบบยังไม่ได้สร้างคำสั่งซื้อ กรุณาตรวจสอบตะกร้า",
  prescription: "สินค้าที่ต้องใช้ใบสั่งยา ต้องสั่งซื้อผ่านใบสั่งยาของแพทย์",
  stock: "สต็อกสินค้าเปลี่ยนแปลงและไม่เพียงพอ กรุณากลับไปตรวจสอบตะกร้า",
  payment: "ระบบชำระเงิน PromptPay ยังไม่พร้อม ระบบยังไม่ได้จองสต็อกหรือสร้างคำสั่งซื้อ",
  limit: "คุณมีคำสั่งซื้อที่รอชำระเงินหรือตรวจสอบการชำระครบ 3 รายการแล้ว กรุณาจัดการหรือรอให้รายการเดิมหมดเวลาก่อนสร้างคำสั่งซื้อใหม่",
  conflict: "คำขอ Checkout นี้เคยใช้กับตะกร้าอื่นแล้ว ระบบไม่ได้เปลี่ยนตะกร้าปัจจุบัน กรุณาตรวจสอบและกดสร้างคำสั่งซื้ออีกครั้ง",
  address: "ไม่พบที่อยู่จัดส่งในบัญชีนี้ กรุณาเลือกหรือเพิ่มที่อยู่แล้วลองอีกครั้ง"
};

const blockReasonCopy: Record<StoreCheckoutBlockReason, { title: string; body: string }> = {
  unavailable: {
    title: "ไม่สามารถโหลดตะกร้าได้",
    body: "ระบบยังตรวจสอบราคาและสต็อกจริงไม่ได้ กรุณาลองใหม่ก่อนสร้างคำสั่งซื้อ"
  },
  stale: {
    title: "มีสินค้าที่ไม่พร้อมจำหน่ายในตะกร้า",
    body: "สินค้าบางรายการถูกปิดขายหรือไม่มีอยู่ในแคตตาล็อกแล้ว กรุณากลับไปล้างรายการที่ไม่พร้อมก่อนสร้างคำสั่งซื้อ"
  },
  empty: {
    title: "ยังไม่มีสินค้าในตะกร้า",
    body: "เลือกสินค้าจากร้านค้าก่อนเข้าสู่ขั้นตอนสร้างคำสั่งซื้อ"
  },
  prescription: {
    title: "มีสินค้าที่ต้องใช้ใบสั่งยา",
    body: "นำสินค้านี้ออกจากตะกร้า แล้วเลือกสั่งซื้อผ่านใบสั่งยาของแพทย์ในระบบ"
  },
  stock: {
    title: "สินค้าไม่เพียงพอ",
    body: "จำนวนสินค้าในตะกร้ามากกว่าสต็อกที่พร้อมขาย กรุณาปรับจำนวนก่อนสร้างคำสั่งซื้อ"
  },
  payment: {
    title: "ระบบชำระเงินยังไม่พร้อม",
    body: "ยังไม่สามารถสร้าง QR PromptPay ที่ถูกต้องได้ ระบบจึงยังไม่จองสต็อกหรือสร้างคำสั่งซื้อ กรุณาลองใหม่เมื่อระบบชำระเงินพร้อม"
  }
};

export function StoreCheckout({
  checkoutStatus,
  checkoutRequestId,
  cart,
  paymentAvailable,
  addresses = []
}: {
  checkoutStatus?: string;
  checkoutRequestId: string;
  cart: CartData;
  paymentAvailable: boolean;
  addresses?: ShippingAddressView[];
}) {
  const items = cart.items.map(mapCartItemToCheckoutItem);
  const blockReason = getStoreCheckoutBlockReason(cart, {
    paymentAvailable: paymentAvailable && checkoutStatus !== "payment"
  });
  const checkoutError =
    checkoutStatus && checkoutStatus !== blockReason
      ? checkoutStatusMessages[checkoutStatus] ?? null
      : null;

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_right,#e0f2f1_0%,#f7f9fb_100%)] pb-8 text-[#191c1e]">
      <CheckoutHeader />

      <main className="mx-auto flex w-full max-w-mobile flex-col gap-8 px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8">
        {items.length > 0 ? (
          <section className="space-y-6">
            <h1 className="px-1 text-xl font-extrabold tracking-tight text-primary">ตรวจสอบรายการสั่งซื้อ</h1>
            <div className="space-y-4">
              {items.map((item) => (
                <CheckoutItemCard key={item.slug} item={item} />
              ))}
            </div>
          </section>
        ) : null}

        {items.length > 0 ? (
          <section className="rounded-[24px] border border-white/40 bg-white/70 p-6 shadow-[0_20px_50px_rgba(0,96,103,0.08)] backdrop-blur-[24px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70">Order total</p>
                <h2 className="mt-2 text-lg font-bold leading-7 text-[#191c1e]">ยอดรวมสินค้า</h2>
              </div>
              <p className="text-2xl font-extrabold leading-7 text-primary">{cart.subtotal}</p>
            </div>
            <p className="mt-5 border-t border-slate-200/50 pt-5 text-xs leading-5 text-[#3e494a]">
              ระบบจะสร้างคำสั่งซื้อและจองสต็อกก่อน จากนั้นจึงแสดง QR และช่องส่งสลิปในหน้าคำสั่งซื้อ
            </p>
          </section>
        ) : null}

        {cart.staleItems.length > 0 ? <StaleCheckoutItems items={cart.staleItems} /> : null}

        {blockReason ? <CheckoutBlockedState reason={blockReason} /> : null}

        {checkoutError ? (
          <p className="rounded-[18px] border border-[#ba1a1a]/20 bg-white/70 px-4 py-3 text-sm font-semibold leading-6 text-[#93000a]">
            {checkoutError}
          </p>
        ) : null}

        {!blockReason ? (
          <section className="pb-12 pt-1 text-center">
            <form action={createStoreCheckoutOrderAction}>
              <input type="hidden" name="checkoutRequestId" value={checkoutRequestId} />
              <ShippingAddressSelector addresses={addresses} returnTo="/store/checkout" />
              {addresses.length > 0 ? <div className="mt-6"><StoreCheckoutSubmit /></div> : null}
            </form>
            <p className="px-4 text-[11px] leading-5 text-[#3e494a]">
              ราคากับสต็อกจะถูกตรวจสอบอีกครั้งบนเซิร์ฟเวอร์ก่อนสร้างคำสั่งซื้อ
            </p>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function mapCartItemToCheckoutItem(item: CartItem): CheckoutItem {
  return {
    slug: item.slug,
    name: item.name,
    pack: item.stockLabel,
    price: item.lineTotal,
    quantity: `x ${item.quantity}`,
    media: item.media === "vitamin" ? "amoxicillin" : "paracetamol",
    requiresPrescription: item.requiresPrescription
  };
}

function CheckoutHeader() {
  return (
    <header className="sticky top-0 z-header bg-white/70 shadow-[0_40px_40px_-15px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-14 w-full max-w-mobile items-center justify-between px-7">
        <div className="flex items-center gap-4">
          <Link href="/store/cart" aria-label="กลับไปที่ตะกร้า" className="text-primary">
            <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.4} />
          </Link>
          <p className="text-lg font-bold tracking-wide text-primary">Checkout</p>
        </div>
        <div className="size-6" />
      </div>
    </header>
  );
}

function CheckoutBlockedState({ reason }: { reason: StoreCheckoutBlockReason }) {
  const copy = blockReasonCopy[reason];
  const href =
    reason === "empty" || reason === "unavailable" || reason === "payment"
      ? "/store"
      : "/store/cart";
  const cta =
    reason === "empty" || reason === "unavailable"
      ? "กลับไปเลือกสินค้า"
      : reason === "payment"
        ? "กลับไปหน้าร้านค้า"
        : "กลับไปตรวจสอบตะกร้า";

  return (
    <section className="rounded-[24px] border border-[#ba1a1a]/15 bg-white/75 p-6 text-center shadow-[0_10px_30px_rgba(0,96,103,0.05)] backdrop-blur-[24px]">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#fff1f0] text-[#93000a]">
        <AlertTriangle aria-hidden="true" className="size-5" />
      </span>
      <h2 className="mt-4 text-base font-extrabold text-primary">{copy.title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#3e494a]">{copy.body}</p>
      <Link href={href} className="mt-5 inline-flex text-sm font-bold text-primary underline-offset-4 hover:underline">
        {cta}
      </Link>
    </section>
  );
}

function StaleCheckoutItems({ items }: { items: StaleCartItem[] }) {
  return (
    <section className="rounded-[20px] border border-[#ba1a1a]/20 bg-white/75 px-5 py-4 text-[#93000a]">
      <p className="text-sm font-extrabold">รายการที่ถูกปิดขายหรือไม่พบในแคตตาล็อก</p>
      <ul className="mt-2 space-y-1 text-xs font-semibold leading-5">
        {items.map((item) => (
          <li key={item.slug}>
            {item.slug} × {item.quantity}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-5">กลับไปที่ตะกร้าเพื่อล้างรายการเหล่านี้ก่อน Checkout</p>
    </section>
  );
}

function CheckoutItemCard({ item }: { item: CheckoutItem }) {
  return (
    <article className="flex gap-4 rounded-[24px] bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-[#bdc9ca]/15">
      <div className="relative size-24 shrink-0 overflow-hidden rounded-[16px] bg-[#eceef0]">
        <CheckoutItemMedia item={item} />
        {item.requiresPrescription ? (
          <span className="absolute left-1 top-1 rounded bg-[#ba1a1a] px-1.5 py-0.5 text-[10px] font-bold leading-tight text-white">
            ต้องมีใบสั่งแพทย์
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
        <div>
          <h2 className="truncate text-base font-bold leading-6 text-[#191c1e]">{item.name}</h2>
          <p className="mt-1 text-xs text-[#3e494a]">{item.pack}</p>
        </div>
        <div className="flex items-end justify-between">
          <span className="text-base font-bold text-primary">{item.price}</span>
          <span className="text-xs text-[#3e494a]">{item.quantity}</span>
        </div>
      </div>
    </article>
  );
}

function CheckoutItemMedia({ item }: { item: CheckoutItem }) {
  if (item.media === "amoxicillin") {
    return (
      <div
        role="img"
        aria-label={item.name}
        className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_45%,#5ecce1_0%,#006a7b_78%)]"
      >
        <div className="h-[58%] w-[44%] rounded-b-[8px] rounded-t-[6px] bg-[#d8e5e7] shadow-[0_8px_14px_rgba(0,0,0,0.24)]">
          <div className="mx-auto h-2 w-[70%] rounded-b bg-[#9da8ab]" />
          <div className="mx-auto mt-4 h-5 w-[72%] rounded bg-white" />
        </div>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={item.name}
      className="relative flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_45%,#ffffff_0%,#eff4f4_100%)]"
    >
      <div className="absolute bottom-7 left-3 h-3 w-10 rounded-full bg-white shadow">
        <div className="h-full w-1/2 rounded-l-full bg-[#e7462f]" />
      </div>
      <div className="relative h-[58%] w-[36%] rotate-[-7deg] rounded-b-[8px] rounded-t-[5px] bg-[#a94b16] shadow-[0_8px_15px_rgba(0,0,0,0.22)]">
        <div className="absolute -top-2 left-1/2 h-3 w-[110%] -translate-x-1/2 rounded-t bg-[#f2f5f5]" />
        <div className="absolute inset-x-0 top-5 h-5 bg-[#11a7c6]" />
      </div>
    </div>
  );
}
