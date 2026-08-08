import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { clearCartAction, updateCartItemAction } from "@/features/cart/actions";
import type { CartData, CartItem, StaleCartItem } from "@/features/cart/types";

export function CustomerCart({ data, cartStatus }: { data: CartData; cartStatus?: string }) {
  const statusMessage =
    cartStatus === "added"
      ? "เพิ่มสินค้าในตะกร้าแล้ว"
      : cartStatus === "updated"
        ? "อัปเดตตะกร้าแล้ว"
        : cartStatus === "cleared"
          ? "ล้างตะกร้าแล้ว"
          : cartStatus === "invalid"
            ? "ไม่สามารถอัปเดตตะกร้าได้"
            : null;

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#f7f9fb] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <CartHeader itemCount={data.itemCount} />

      <main className="mx-auto w-full max-w-mobile space-y-5 px-4 py-5">
        <section className="rounded-[24px] border border-white/40 bg-white/70 p-5 shadow-[0_10px_30px_rgba(0,96,103,0.08)] backdrop-blur-[24px]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/70">Cart</p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-primary">ตะกร้าสินค้า</h1>
          <div className="mt-5 flex items-center justify-between rounded-[18px] bg-primary/5 px-4 py-3">
            <span className="text-sm font-bold text-[#3e494a]">{data.itemCount} รายการ</span>
            <span className="text-lg font-extrabold text-primary">{data.subtotal}</span>
          </div>
        </section>

        {statusMessage ? (
          <p className="rounded-[18px] bg-white/80 px-4 py-3 text-sm font-semibold leading-6 text-primary shadow-[0_8px_24px_rgba(0,96,103,0.04)]">
            {statusMessage}
          </p>
        ) : null}

        {data.staleItems.length > 0 ? <StaleCartNotice items={data.staleItems} /> : null}

        {data.unavailable ? (
          <EmptyCart title="ไม่สามารถโหลดตะกร้าได้" body="กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูลและลองใหม่" />
        ) : data.items.length === 0 ? (
          <EmptyCart title="ยังไม่มีสินค้าในตะกร้า" body="เลือกสินค้าจากร้านค้าแล้วกลับมาตรวจสอบก่อนชำระเงิน" />
        ) : (
          <>
            <section className="space-y-4">
              {data.items.map((item) => (
                <CartItemCard key={item.slug} item={item} />
              ))}
            </section>

            <section className="rounded-[24px] border border-white/40 bg-white/70 p-5 shadow-[0_10px_30px_rgba(0,96,103,0.05)] backdrop-blur-[24px]">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-[#3e494a]">Subtotal</span>
                <span className="text-xl font-extrabold text-primary">{data.subtotal}</span>
              </div>
              {data.staleItems.length > 0 ? (
                <span
                  aria-disabled="true"
                  className="mt-5 flex h-14 w-full cursor-not-allowed items-center justify-center rounded-full bg-[#bdc9ca] px-5 text-center text-sm font-extrabold text-white"
                >
                  ล้างรายการที่ไม่พร้อมก่อน Checkout
                </span>
              ) : (
                <Link
                  href="/store/checkout"
                  className="mt-5 flex min-h-12 w-full items-center justify-center rounded-full bg-primary-gradient text-sm font-extrabold text-white shadow-[0_12px_24px_-8px_rgba(0,96,103,0.4)] active:scale-[0.98]"
                >
                  ไปชำระเงิน
                </Link>
              )}
              <form action={clearCartAction}>
                <button type="submit" className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-bold text-[#93000a]">
                  <Trash2 aria-hidden="true" className="size-4" />
                  ล้างตะกร้า
                </button>
              </form>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function StaleCartNotice({ items }: { items: StaleCartItem[] }) {
  return (
    <section className="rounded-[24px] border border-[#ba1a1a]/20 bg-white/80 p-5 text-[#93000a] shadow-[0_8px_24px_rgba(0,96,103,0.04)]">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div>
          <h2 className="text-sm font-extrabold">มีสินค้าที่ถูกปิดขายหรือไม่พบแล้ว</h2>
          <p className="mt-1 text-xs leading-5">
            รายการต่อไปนี้ยังอยู่ใน cookie ตะกร้า แต่ไม่สามารถใช้สร้างคำสั่งซื้อได้
          </p>
          <ul className="mt-2 space-y-1 text-xs font-semibold leading-5">
            {items.map((item) => (
              <li key={item.slug}>
                {item.slug} × {item.quantity}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <form action={clearCartAction}>
        <button
          type="submit"
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#ba1a1a]/25 bg-white text-sm font-bold"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          ล้างตะกร้าและเริ่มใหม่
        </button>
      </form>
    </section>
  );
}

function CartHeader({ itemCount }: { itemCount: number }) {
  return (
    <header className="sticky top-0 z-header bg-white/70 shadow-[0_40px_40px_-15px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-14 w-full max-w-mobile items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link href="/store" aria-label="Back to store" className="text-primary">
            <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.4} />
          </Link>
          <p className="text-lg font-bold tracking-wide text-primary">Cart</p>
        </div>
        <span className="relative text-primary">
          <ShoppingBag aria-hidden="true" className="size-6" />
          {itemCount > 0 ? (
            <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {itemCount}
            </span>
          ) : null}
        </span>
      </div>
    </header>
  );
}

function CartItemCard({ item }: { item: CartItem }) {
  return (
    <article className="rounded-[24px] border border-white/40 bg-white/70 p-4 shadow-[0_10px_30px_rgba(0,96,103,0.05)] backdrop-blur-[24px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-extrabold text-[#191c1e]">{item.name}</h2>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[#6e797a]">{item.stockLabel}</p>
          {item.requiresPrescription ? <p className="mt-2 text-xs font-bold text-[#93000a]">ต้องมีใบสั่งแพทย์</p> : null}
        </div>
        <div className="text-right">
          <p className="text-base font-extrabold text-primary">{item.lineTotal}</p>
          <p className="mt-1 text-xs text-[#6e797a]">{item.price} / ชิ้น</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-[18px] bg-white/80 px-4 py-2.5">
        <QuantityForm item={item} quantity={Math.max(item.quantity - 1, 0)} label="ลดจำนวน">
          <Minus aria-hidden="true" className="size-4" />
        </QuantityForm>
        <span className="text-base font-extrabold text-[#191c1e]">{item.quantity}</span>
        <QuantityForm item={item} quantity={Math.min(item.quantity + 1, 10)} label="เพิ่มจำนวน">
          <Plus aria-hidden="true" className="size-4" />
        </QuantityForm>
      </div>
    </article>
  );
}

function QuantityForm({ item, quantity, label, children }: { item: CartItem; quantity: number; label: string; children: ReactNode }) {
  return (
    <form action={updateCartItemAction}>
      <input type="hidden" name="slug" value={item.slug} />
      <input type="hidden" name="quantity" value={quantity} />
      <button type="submit" aria-label={label} className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        {children}
      </button>
    </form>
  );
}

function EmptyCart({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-[24px] border border-white/40 bg-white/70 p-6 text-center shadow-[0_10px_30px_rgba(0,96,103,0.05)] backdrop-blur-[24px]">
      <h2 className="text-base font-bold text-primary">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#3e494a]">{body}</p>
      <Link href="/store" className="mt-5 inline-flex text-sm font-bold text-primary underline-offset-4 hover:underline">
        เลือกสินค้า
      </Link>
    </section>
  );
}
