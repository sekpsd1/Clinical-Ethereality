import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  AlertTriangle,
  PackageX,
  ShieldCheck,
  ShoppingCart,
  WifiOff
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { addToCartAction } from "@/features/cart/actions";
import { ExternalPrescriptionOrderForm } from "@/features/products/ExternalPrescriptionOrderForm";
import type { StoreProductDetailData, StoreProductDetailItem } from "@/features/products/types";
import type { StorageReadiness } from "@/lib/storage/provider";

export function ProductDetail({
  data,
  externalPrescriptionStatus,
  storageReadiness
}: {
  data: StoreProductDetailData;
  externalPrescriptionStatus?: string;
  storageReadiness: StorageReadiness;
}) {
  const product = data.product;

  if (!product) {
    return <ProductDetailState unavailable={Boolean(data.unavailable)} />;
  }

  const isOutOfStock = product.availableQuantity <= 0;

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#f7f9fb] pb-[calc(10.5rem+env(safe-area-inset-bottom))] text-[#3e494a]">
      <ProductDetailHeader />
      <ProductHero product={product} />

      <main className="relative z-10 -mt-10 flex flex-col gap-6 px-7">
        <section className="rounded-[24px] border border-[#bdc9ca]/15 bg-white/70 p-6 shadow-[0_8px_32px_rgba(0,96,103,0.04)] backdrop-blur-[24px]">
          <div className="mb-5 flex flex-col gap-2">
            <p className="text-[11px] font-bold text-primary">{product.categoryLabel}</p>
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
                  ต้องมีใบสั่งยาจากแพทย์ก่อนสั่งซื้อ และเมื่อมีใบสั่งยาแล้วไม่ต้องรอตรวจเอกสารซ้ำ
                </p>
              </div>
            </div>
          ) : null}
          {product.controlledOrRestricted ? (
            <p className="mt-3 rounded-[16px] bg-[#fff4e8] px-4 py-3 text-xs font-bold leading-5 text-[#744500]">
              สินค้าควบคุมหรือมีข้อจำกัด กรุณาตรวจสอบเงื่อนไขก่อนสั่งซื้อ
            </p>
          ) : null}
        </section>

        {product.requiresPrescription ? (
          <ExternalPrescriptionOrderCard product={product} status={externalPrescriptionStatus} storageReadiness={storageReadiness} />
        ) : null}

        <section className="rounded-[24px] border border-[#bdc9ca]/15 bg-white/70 p-6 shadow-[0_8px_32px_rgba(0,96,103,0.04)] backdrop-blur-[24px]">
          <h2 className="mb-4 text-base font-extrabold leading-6 text-primary">รายละเอียดสินค้า</h2>
          <div className="space-y-4 text-sm leading-7 text-[#3e494a]">
            <p>{product.longDescription}</p>
            {product.usageInstructions ? <ProductInformation label="วิธีใช้" value={product.usageInstructions} /> : null}
            {product.fdaNumber ? (
              <div className="flex items-center gap-3 font-semibold text-primary">
                <ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-primary" />
                <span>เลข อย. {product.fdaNumber}</span>
              </div>
            ) : null}
            {product.warnings ? (
              <div className="rounded-[16px] bg-[#f7f9fb] p-4 text-xs leading-5 text-[#3e494a]">
                <p className="font-bold not-italic text-[#191c1e]">คำเตือน / ข้อห้ามใช้</p>
                <p className="mt-1 whitespace-pre-line">{product.warnings}</p>
              </div>
            ) : null}
            {product.storageInstructions ? (
              <ProductInformation label="การเก็บรักษา" value={product.storageInstructions} />
            ) : null}
            {product.specialFulfillmentNotes ? (
              <ProductInformation label="การจัดเตรียมและจัดส่ง" value={product.specialFulfillmentNotes} />
            ) : null}
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[45] px-7">
        <div className="mx-auto w-full max-w-mobile">
          {isOutOfStock ? (
            <button
              type="button"
              disabled
              className="flex h-14 w-full cursor-not-allowed items-center justify-center gap-3 rounded-[24px] bg-[#bdc9ca] text-base font-bold text-white shadow-[0_10px_25px_rgba(0,96,103,0.12)]"
            >
              <PackageX aria-hidden="true" className="size-5" />
              สินค้าหมดชั่วคราว
            </button>
          ) : product.requiresPrescription ? (
            <Link
              href="/consult/prescriptions"
              className="flex h-14 w-full items-center justify-center gap-3 rounded-[24px] bg-primary-gradient text-base font-bold text-white shadow-[0_10px_25px_rgba(0,96,103,0.32)] active:scale-[0.98]"
            >
              <ShoppingCart aria-hidden="true" className="size-5" />
              ใช้ใบสั่งยาในระบบ
            </Link>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}

function ProductInformation({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-bold text-[#191c1e]">{label}</p>
      <p className="mt-1 whitespace-pre-line">{value}</p>
    </div>
  );
}

function ProductDetailState({ unavailable }: { unavailable: boolean }) {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#f7f9fb] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#3e494a]">
      <ProductDetailHeader />
      <main className="px-7 pt-28">
        <EmptyState
          className={unavailable ? "border-[#ba1a1a]/20 bg-white/80" : "bg-white/80"}
          title={unavailable ? "ไม่สามารถโหลดรายละเอียดสินค้าได้" : "ไม่พบสินค้านี้"}
          body={
            unavailable
              ? "ระบบไม่สามารถเชื่อมต่อแคตตาล็อกสินค้าได้ในขณะนี้ จึงยังไม่สามารถสั่งซื้อสินค้าได้"
              : "สินค้านี้อาจถูกปิดการขายหรือไม่มีอยู่ในแคตตาล็อกที่เปิดใช้งาน"
          }
          icon={
            unavailable ? (
              <WifiOff aria-hidden="true" className="size-5 text-[#93000a]" />
            ) : (
              <PackageX aria-hidden="true" className="size-5" />
            )
          }
          action={
            <Link href="/store" className="text-sm font-bold text-primary underline-offset-4 hover:underline">
              กลับไปหน้าร้านค้า
            </Link>
          }
        />
      </main>
    </div>
  );
}

function ExternalPrescriptionOrderCard({
  product,
  status,
  storageReadiness
}: {
  product: StoreProductDetailItem;
  status?: string;
  storageReadiness: StorageReadiness;
}) {
  return (
    <section className="rounded-[24px] border border-primary/20 bg-white/70 p-6 shadow-[0_8px_32px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="mb-4">
        <h2 className="text-base font-extrabold leading-6 text-primary">แนบใบสั่งยาจากภายนอก</h2>
        <p className="mt-1 text-xs leading-5 text-[#3e494a]">
          ใช้ URL ไฟล์จาก storage ที่ได้รับอนุญาต ระบบจะบันทึกเฉพาะ metadata เพื่อผูกกับคำสั่งซื้อ
        </p>
      </div>

      <p className="mb-4 rounded-[14px] bg-teal-50/70 px-3 py-2 text-[11px] font-semibold leading-5 text-primary">
        {storageReadiness.isConfigured
          ? `Storage พร้อมใช้งานผ่าน ${storageReadiness.provider}${storageReadiness.publicBaseUrl ? " และตรวจ URL ตาม base URL ที่ตั้งไว้" : ""}`
          : "ยังไม่ได้ตั้งค่า Cloudinary/S3 สำหรับอัปโหลดจริง ตอนนี้รับ hosted URL จาก storage ที่ owner จัดเตรียมและบันทึก metadata ก่อน"}
      </p>

      {status === "failed" || status === "invalid" || status === "limit" ? (
        <p className="mb-4 rounded-[16px] border border-[#ba1a1a]/20 bg-white/70 px-4 py-3 text-xs font-bold leading-5 text-[#93000a]">
          {status === "limit"
            ? "คุณมีคำสั่งซื้อที่รอชำระเงินหรือตรวจสอบการชำระครบ 3 รายการแล้ว กรุณาจัดการหรือรอให้รายการเดิมหมดเวลาก่อนสร้างคำสั่งซื้อใหม่"
            : "ไม่สามารถสร้างคำสั่งซื้อจากใบสั่งยาภายนอกได้ กรุณาตรวจสอบ URL และชื่อไฟล์อีกครั้ง"}
        </p>
      ) : null}

      {product.availableQuantity > 0 ? (
        <ExternalPrescriptionOrderForm productSlug={product.slug} />
      ) : (
        <p className="rounded-[16px] border border-[#ba1a1a]/20 bg-white/70 px-4 py-3 text-xs font-bold leading-5 text-[#93000a]">
          สินค้าหมดชั่วคราว จึงยังไม่สามารถสร้างคำสั่งซื้อพร้อมใบสั่งยาได้
        </p>
      )}
    </section>
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
        <span aria-hidden="true" className="size-10 shrink-0" />
      </div>
    </header>
  );
}

function ProductHero({ product }: { product: StoreProductDetailItem }) {
  if (product.imageUrl) {
    return (
      <section className="mt-16 aspect-square w-full overflow-hidden bg-[#eceef0]">
        <div className="relative h-full w-full">
          <Image src={product.imageUrl} alt={product.imageAlt} fill sizes="480px" className="object-contain p-6" priority />
        </div>
      </section>
    );
  }

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
          <div className="absolute left-1/2 top-[39%] w-[90%] -translate-x-1/2 text-center">
            <p className="line-clamp-2 text-[10px] font-extrabold leading-tight text-white">{product.name}</p>
            <p className="mt-1 text-[6px] font-bold uppercase tracking-wide text-[#d7faff]">Clinical Ethereality</p>
          </div>
          <div className="absolute left-[16%] top-[12%] h-[70%] w-[13%] rounded-full bg-white/20 blur-sm" />
        </div>
      </div>
    </section>
  );
}
