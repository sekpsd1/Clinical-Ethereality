import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  Check,
  CheckCircle2,
  Edit3,
  ShieldCheck,
  Share2,
  ShoppingCart,
  UserRound
} from "lucide-react";
import { addToCartAction } from "@/features/cart/actions";
import type { StoreProductDetailData, StoreProductDetailItem } from "@/features/products/types";

const fallbackProduct: StoreProductDetailItem = {
  id: "fallback-paracetamol",
  name: "Paracetamol 500mg",
  slug: "paracetamol-500mg",
  price: "฿1,200",
  description: "ยาสามัญประจำบ้านสำหรับข้อมูลทดสอบร้านค้า",
  imageAlt: "Premium medical bottle of Paracetamol 500mg",
  media: "kit",
  href: "/store/paracetamol-500mg",
  cta: "สั่งซื้อทันที",
  requiresPrescription: false,
  stockLabel: "พร้อมจัดส่ง",
  featured: false,
  longDescription: "ยาสามัญประจำบ้านสำหรับข้อมูลทดสอบร้านค้า"
};

export function ProductDetail({ data }: { data: StoreProductDetailData }) {
  const product = data.product ?? fallbackProduct;

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#f7f9fb] pb-[calc(10.5rem+env(safe-area-inset-bottom))] text-[#3e494a]">
      <ProductDetailHeader />
      <ProductHero product={product} />

      <main className="relative z-10 -mt-10 flex flex-col gap-6 px-7">
        {data.unavailable || !data.product ? (
          <section className="rounded-[24px] border border-[#ba1a1a]/20 bg-white/80 p-4 text-sm font-semibold leading-6 text-[#93000a] shadow-[0_8px_32px_rgba(0,96,103,0.04)] backdrop-blur-[24px]">
            {data.unavailable ? "ไม่สามารถโหลดรายละเอียดสินค้าจากฐานข้อมูลได้ กำลังแสดงข้อมูลสำรอง" : "ไม่พบสินค้านี้ในแคตตาล็อกที่เปิดใช้งาน กำลังแสดงข้อมูลสำรอง"}
          </section>
        ) : null}

        <section className="rounded-[24px] border border-[#bdc9ca]/15 bg-white/70 p-6 shadow-[0_8px_32px_rgba(0,96,103,0.04)] backdrop-blur-[24px]">
          <div className="mb-5 flex flex-col gap-2">
            <h1 className="text-[22px] font-extrabold leading-7 text-[#191c1e]">{product.name}</h1>
            <p className="text-[22px] font-bold leading-7 text-[#191c1e]">{product.price}</p>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6e797a]">{product.stockLabel}</p>
          </div>

          {product.requiresPrescription ? (
            <div className="flex gap-3 rounded-[16px] border border-[#ba1a1a]/20 bg-white/50 p-4 text-[#93000a]">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 fill-[#ba1a1a] text-[#ba1a1a]" />
              <div>
                <p className="text-sm font-bold leading-tight">Prescription Required (ต้องมีใบสั่งแพทย์)</p>
                <p className="mt-1 text-xs leading-5">
                  ยาตัวนี้ต้องได้รับการตรวจสอบจากแพทย์ก่อนทำการสั่งซื้อ
                </p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="pl-1 text-lg font-extrabold leading-7 text-primary">
            เลือกจากประวัติการปรึกษา (Advice Log)
          </h2>

          <div className="rounded-[24px] border border-primary/20 bg-white/70 p-5 shadow-[0_8px_32px_rgba(0,96,103,0.08)] backdrop-blur-[24px]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRound aria-hidden="true" className="size-5" />
                </span>
                <p className="truncate text-sm font-extrabold leading-5 text-[#191c1e]">
                  นพ. ธีรภัทร รัตนวานิช | 10 พ.ค. 2567
                </p>
              </div>
              <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 fill-primary text-white" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-[18px] border-2 border-primary bg-primary/5 p-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                  <Check aria-hidden="true" className="size-5" strokeWidth={3} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-primary">Amoxicillin 500mg</p>
                  <p className="text-[10px] font-bold uppercase leading-4 text-primary/70">
                    รายการที่ใช้ยืนยันการซื้อนี้
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[18px] bg-white p-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e6e8ea]">
                  <span className="size-4 rounded-full border-2 border-[#6e797a]" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#3e494a]">Paracetamol 500mg</p>
                  <p className="text-[10px] font-medium leading-4 text-[#616363]">รายการอื่นๆ ในใบสั่งนี้</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-[16px] py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/5"
            >
              เปลี่ยนการเลือกใบสั่งยา
              <Edit3 aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#bdc9ca]/15 bg-white/70 p-6 shadow-[0_8px_32px_rgba(0,96,103,0.04)] backdrop-blur-[24px]">
          <h2 className="mb-4 text-base font-extrabold leading-6 text-primary">รายละเอียดสินค้า</h2>
          <div className="space-y-4 text-sm leading-7 text-[#3e494a]">
            <p>{product.longDescription}</p>
            <div className="flex items-center gap-3 font-semibold text-primary">
              <ShieldCheck aria-hidden="true" className="size-5 fill-primary text-white" />
              <span>ผ่านการทดสอบทางคลินิก</span>
            </div>
            <p className="rounded-[16px] bg-[#f7f9fb] p-4 text-xs italic leading-5 text-[#3e494a]">
              คำเตือน: โปรดใช้ตามคำแนะนำของแพทย์อย่างเคร่งครัด หากมีอาการแพ้หรือระคายเคืองควรหยุดใช้และปรึกษาแพทย์ทันที
            </p>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[45] px-7">
        <div className="mx-auto w-full max-w-mobile">
          <form action={addToCartAction}>
            <input type="hidden" name="slug" value={product.slug} />
            <input type="hidden" name="quantity" value="1" />
            <button
              type="submit"
              className="flex h-14 w-full items-center justify-center gap-3 rounded-[24px] bg-primary-gradient text-base font-bold text-white shadow-[0_10px_25px_rgba(0,96,103,0.32)] active:scale-[0.98]"
            >
              <ShoppingCart aria-hidden="true" className="size-5" />
              เพิ่มลงตะกร้า
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ProductDetailHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-header bg-white/70 shadow-[0_40px_40px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-16 w-full max-w-mobile items-center justify-between px-7">
        <div className="flex items-center gap-4">
          <Link href="/store" aria-label="Back to store" className="flex size-10 items-center justify-center rounded-full text-primary">
            <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.4} />
          </Link>
          <p className="text-lg font-bold leading-6 text-[#191c1e]">Medication Details</p>
        </div>
        <button type="button" aria-label="Share product" className="flex size-10 items-center justify-center rounded-full text-primary">
          <Share2 aria-hidden="true" className="size-5" strokeWidth={2.4} />
        </button>
      </div>
    </header>
  );
}

function ProductHero({ product }: { product: StoreProductDetailItem }) {
  const heroClass =
    product.media === "vitamin"
      ? "relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_58%,#ffb15d_0%,#e95f12_62%,#c9480d_100%)]"
      : product.media === "gel"
        ? "relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_25%_18%,rgba(122,213,221,0.35),transparent_24%),linear-gradient(145deg,#0d3438,#09282d_58%,#071c21)]"
        : "relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_45%,#ffffff_0%,#f8fbfb_48%,#eef3f2_100%)]";

  return (
    <section className="mt-16 aspect-square w-full overflow-hidden bg-[#eceef0]">
      <div
        role="img"
        aria-label={product.imageAlt}
        className={heroClass}
      >
        <div className="absolute bottom-[18%] left-[23%] h-4 w-[20%] rounded-full bg-black/10 blur-md" />
        <div className="absolute bottom-[18%] left-[18%] h-6 w-[19%] rotate-[-2deg] rounded-full bg-white shadow-[0_10px_20px_rgba(0,0,0,0.18)]">
          <div className="h-full w-[52%] rounded-l-full bg-[#e7462f]" />
        </div>
        <div className="relative mt-2 h-[56%] w-[36%] rotate-[-7deg] rounded-b-[22px] rounded-t-[12px] bg-[#a94b16] shadow-[0_18px_35px_rgba(30,64,62,0.28)]">
          <div className="absolute -top-[17%] left-1/2 h-[22%] w-[105%] -translate-x-1/2 rounded-t-[14px] bg-[#f2f5f5] shadow-[inset_8px_0_0_rgba(0,0,0,0.03),inset_16px_0_0_rgba(0,0,0,0.03),inset_24px_0_0_rgba(0,0,0,0.03)]" />
          <div className="absolute inset-x-0 top-[30%] h-[38%] bg-[#11a7c6] shadow-[0_4px_10px_rgba(0,0,0,0.18)]" />
          <div className="absolute left-1/2 top-[23%] flex size-12 -translate-x-1/2 items-center justify-center rounded-full bg-[#0b90b0]">
            <div className="h-3 w-8 rounded-full bg-white" />
          </div>
          <div className="absolute left-1/2 top-[39%] -translate-x-1/2 text-center">
            <p className="text-[24px] font-extrabold leading-none text-white">Paraceemol</p>
            <p className="mt-1 text-[8px] font-bold uppercase tracking-wide text-[#d7faff]">SAFE OIRC WORK</p>
          </div>
          <div className="absolute left-[16%] top-[12%] h-[70%] w-[13%] rounded-full bg-white/20 blur-sm" />
        </div>
      </div>
    </section>
  );
}
