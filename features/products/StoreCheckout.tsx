import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CloudUpload, Edit3, MapPin } from "lucide-react";
import { createStoreCheckoutOrderAction } from "@/features/products/checkout/actions";

type CheckoutItem = {
  name: string;
  pack: string;
  price: string;
  quantity: string;
  media: "paracetamol" | "amoxicillin";
  requiresPrescription?: boolean;
};

const checkoutItems: CheckoutItem[] = [
  {
    name: "Paracetamol 500mg",
    pack: "1 แผง (10 เม็ด)",
    price: "1,200.-",
    quantity: "x 1",
    media: "paracetamol",
    requiresPrescription: true
  },
  {
    name: "Amoxicillin 500mg",
    pack: "1 แผง (10 เม็ด)",
    price: "600.-",
    quantity: "x 1",
    media: "amoxicillin"
  }
];

export function StoreCheckout() {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_right,#e0f2f1_0%,#f7f9fb_100%)] pb-8 text-[#191c1e]">
      <CheckoutHeader />

      <main className="mx-auto flex w-full max-w-mobile flex-col gap-10 px-6 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8">
        <section className="space-y-6">
          <h1 className="px-1 text-xl font-extrabold tracking-tight text-primary">รายการสั่งซื้อ</h1>
          <div className="space-y-4">
            {checkoutItems.map((item) => (
              <CheckoutItemCard key={item.name} item={item} />
            ))}
          </div>
        </section>

        <section className="rounded-[24px] border border-white/40 bg-white/70 p-6 shadow-[0_20px_50px_rgba(0,96,103,0.08)] backdrop-blur-[24px]">
          <div className="mb-7 flex items-start justify-between gap-4">
            <h2 className="text-lg font-bold leading-7 text-[#191c1e]">ชำระเงิน (Payment)</h2>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#3e494a]">Total Amount</p>
              <p className="mt-1 text-2xl font-extrabold leading-7 text-primary">฿1,800.00</p>
            </div>
          </div>

          <div className="rounded-[24px] bg-white p-6 shadow-[inset_0_2px_12px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
            <div className="mx-auto mb-5 flex w-full max-w-[252px] items-center justify-center rounded-[18px] border-2 border-slate-50 bg-white p-4">
              <Image
                src="/images/payments/promptpay-qr-1000.png"
                alt="PromptPay QR code for store checkout payment"
                width={224}
                height={224}
                className="h-auto w-full"
                priority
              />
            </div>
            <p className="text-center text-sm leading-6 text-[#3e494a]">
              กรุณาสแกน QR Code เพื่อชำระเงิน
              <br />
              <span className="text-[10px] text-slate-400">Dynamic QR Code expires in 15:00</span>
            </p>
          </div>

          <div className="mt-6 space-y-3 border-t border-slate-200/50 pt-5">
            <div className="flex justify-between text-sm">
              <span className="text-[#3e494a]">Subtotal</span>
              <span className="font-medium">฿1,800.00</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#3e494a]">Shipping</span>
              <span className="font-semibold text-primary">Free</span>
            </div>
          </div>
        </section>

        <label className="flex min-h-[152px] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-teal-200/70 bg-white/70 p-6 shadow-[0_15px_35px_rgba(0,0,0,0.03)] backdrop-blur-[24px]">
          <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-teal-50 text-primary">
            <CloudUpload aria-hidden="true" className="size-6" />
          </span>
          <span className="block text-center text-sm font-bold text-primary">แนบหลักฐานการโอนเงิน</span>
          <span className="mt-1 block text-center text-[10px] uppercase tracking-tight text-[#3e494a]">
            Upload transaction slip
          </span>
          <input type="file" className="hidden" />
        </label>

        <section className="rounded-[24px] border border-white/40 bg-white/70 p-6 shadow-[0_15px_35px_rgba(0,0,0,0.03)] backdrop-blur-[24px]">
          <div className="flex items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[16px] bg-teal-50 text-primary">
              <MapPin aria-hidden="true" className="size-5" fill="#006067" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="mb-1 text-sm font-bold text-[#191c1e]">ที่อยู่จัดส่ง (Delivery)</h2>
              <p className="text-xs leading-5 text-[#3e494a]">
                123/45 หมู่บ้านอีธีเรียล แขวงลุมพินี เขตปทุมวัน กรุงเทพมหานคร 10330
              </p>
            </div>
            <button type="button" aria-label="Edit delivery address" className="shrink-0 rounded-full p-1 text-primary">
              <Edit3 aria-hidden="true" className="size-5" />
            </button>
          </div>
        </section>

        <section className="pb-12 pt-1 text-center">
          <form action={createStoreCheckoutOrderAction}>
            <input type="hidden" name="productSlugs" value="paracetamol-500mg" />
            <input type="hidden" name="productSlugs" value="vitamin-c-complex" />
            <button
              type="submit"
              className="mb-5 flex h-14 w-full items-center justify-center rounded-full bg-primary-gradient text-base font-extrabold text-white shadow-[0_12px_24px_-8px_rgba(0,96,103,0.4)] active:scale-[0.98]"
            >
              แจ้งชำระเงินแล้ว
            </button>
          </form>
          <p className="px-4 text-[10px] leading-4 text-[#3e494a]">
            By completing this transaction, you agree to our{" "}
            <span className="text-primary underline">Terms of Service</span> and{" "}
            <span className="text-primary underline">Clinical Care Privacy Policy</span>.
          </p>
        </section>
      </main>
    </div>
  );
}

function CheckoutHeader() {
  return (
    <header className="sticky top-0 z-header bg-white/70 shadow-[0_40px_40px_-15px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-14 w-full max-w-mobile items-center justify-between px-7">
        <div className="flex items-center gap-4">
          <Link href="/store/paracetamol-500mg" aria-label="Back to product detail" className="text-primary">
            <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.4} />
          </Link>
          <p className="text-lg font-bold tracking-wide text-primary">Checkout</p>
        </div>
        <div className="size-6" />
      </div>
    </header>
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
        aria-label="Amoxicillin medicine bottle"
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
      aria-label="Paracetamol medicine bottle"
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
