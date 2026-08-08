import Link from "next/link";
import Image from "next/image";
import { ClipboardPlus, Leaf, Lock, PackageSearch, Pill, Search, ShoppingCart, Sparkles, Syringe, WifiOff } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import type { StoreMarketplaceData, StoreProductListItem } from "@/features/products/types";

type Category = {
  label: string;
  icon: typeof ClipboardPlus;
  locked?: boolean;
};

type Product = StoreProductListItem;

const categories: Category[] = [
  { label: "ตรวจเชื้อ HPV/STD", icon: ClipboardPlus },
  { label: "ยาตามใบสั่งแพทย์", icon: Pill, locked: true },
  { label: "วิตามิน/สินค้าทั่วไป", icon: Leaf },
  { label: "จองวัคซีน", icon: Syringe }
];

export function HealthMarketplace({ data }: { data: StoreMarketplaceData }) {
  const marketplaceProducts = data.products;
  const featuredProduct = marketplaceProducts.find((product) => product.featured) ?? marketplaceProducts[0];
  const standardProducts = featuredProduct
    ? marketplaceProducts.filter((product) => product.id !== featuredProduct.id)
    : [];

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#f7f9fb] px-4 pb-8 text-[#3e494a]">
      <MarketplaceHeader />

      <section className="pt-28">
        <h1 className="max-w-[350px] text-[28px] font-extrabold leading-[1.2] tracking-normal text-primary">
          ดูแลสุขภาพคุณ
          <br />
          <span className="text-[#191c1e]">ด้วยความใส่ใจระดับพรีเมียม</span>
        </h1>
        <p className="mt-4 max-w-[292px] text-[15px] leading-6 text-[#3e494a]">
          สัมผัสประสบการณ์การดูแลสุขภาพที่เข้าถึงง่ายและเป็นส่วนตัว
        </p>
      </section>

      <section className="mt-10 grid grid-cols-2 gap-3">
        {categories.map((category) => (
          <CategoryCard key={category.label} category={category} />
        ))}
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between">
          <h2 className="text-[25px] font-extrabold leading-8 text-primary">สินค้าแนะนำ</h2>
          <Link href="/store" className="pb-1 text-xs font-semibold text-primary/60">
            ดูทั้งหมด
          </Link>
        </div>

        {data.unavailable ? (
          <EmptyState
            className="mt-8 border-[#ba1a1a]/20 bg-white/80"
            title="ไม่สามารถโหลดสินค้าได้"
            body="ระบบไม่สามารถเชื่อมต่อแคตตาล็อกสินค้าได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง"
            icon={<WifiOff aria-hidden="true" className="size-5 text-[#93000a]" />}
            action={
              <Link href="/store" className="text-sm font-bold text-primary underline-offset-4 hover:underline">
                ลองใหม่
              </Link>
            }
          />
        ) : marketplaceProducts.length === 0 ? (
          <EmptyState
            className="mt-8 bg-white/80"
            title="ยังไม่มีสินค้าในแคตตาล็อก"
            body="สินค้าที่เปิดจำหน่ายจะแสดงที่นี่เมื่อข้อมูลพร้อม"
            icon={<PackageSearch aria-hidden="true" className="size-5" />}
          />
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {standardProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {featuredProduct ? <FeaturedProductCard product={featuredProduct} /> : null}
          </>
        )}
      </section>
    </div>
  );
}

function MarketplaceHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-header bg-white/70 shadow-[0_0_40px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-[84px] w-full max-w-mobile items-center justify-between gap-3 px-4">
        <Link href="/store" className="text-[21px] font-extrabold leading-tight tracking-normal text-primary">
          Clinical
          <br />
          Ethereality
        </Link>

        <label className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full bg-[#e6e8ea] px-4 text-[#6e797a]">
          <Search aria-hidden="true" className="size-5 shrink-0 text-primary" strokeWidth={2.25} />
          <span className="truncate text-[16px] leading-6 text-[#9aa3a4]">ค้นหา...</span>
        </label>

        <Link href="/store/cart" aria-label="Cart" className="relative shrink-0 text-primary">
          <ShoppingCart aria-hidden="true" className="size-7" strokeWidth={2.6} />
        </Link>
      </div>
    </header>
  );
}

function CategoryCard({ category }: { category: Category }) {
  const Icon = category.icon;

  return (
    <button
      type="button"
      className="flex min-h-[132px] flex-col items-center justify-center gap-3 rounded-[24px] border border-[#bdc9ca]/15 bg-white/70 p-4 text-center shadow-[0_8px_32px_rgba(0,96,103,0.04)] backdrop-blur-[24px] transition-colors hover:bg-white"
    >
      <span className="relative flex size-12 items-center justify-center rounded-full bg-[#d0fbff]/50">
        <Icon aria-hidden="true" className="size-7 text-primary" fill={category.icon === Leaf ? "#006067" : "none"} />
        {category.locked ? (
          <span className="absolute bottom-1 right-0 flex size-5 items-center justify-center rounded-full bg-white text-[#3e494a] shadow-chip">
            <Lock aria-hidden="true" className="size-3" strokeWidth={3} />
          </span>
        ) : null}
      </span>
      <span className="text-[14px] font-bold leading-5 text-[#191c1e]">{category.label}</span>
    </button>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <article className="flex min-h-[300px] flex-col rounded-[24px] border border-[#bdc9ca]/15 bg-white/70 p-4 shadow-[0_8px_32px_rgba(0,96,103,0.04)] backdrop-blur-[24px]">
      <div className="relative aspect-square w-full overflow-hidden rounded-[16px] bg-[#eceef0]">
        <ProductMedia product={product} />
        {product.requiresPrescription ? (
          <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1.5 text-[8px] font-bold uppercase tracking-wide text-white">
            ต้องมีใบสั่งแพทย์
          </span>
        ) : null}
      </div>

      <div className="mt-4 min-w-0">
        <p className="truncate text-[10px] font-bold text-primary">{product.categoryLabel}</p>
        <h3 className="truncate text-base font-bold leading-5 text-[#191c1e]">{product.name}</h3>
        <p className="mt-1.5 text-xl font-extrabold leading-6 text-primary">{product.price}</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6e797a]">{product.stockLabel}</p>
      </div>

      <Link
        href={product.href}
        className="mt-auto flex min-h-11 items-center justify-center rounded-full bg-primary-gradient px-4 text-xs font-bold text-white shadow-chip"
      >
        {product.cta}
      </Link>
    </article>
  );
}

function FeaturedProductCard({ product }: { product: Product }) {
  return (
    <article className="mt-5 flex min-h-[220px] gap-4 rounded-[24px] border border-[#bdc9ca]/15 bg-white/70 p-4 shadow-[0_8px_32px_rgba(0,96,103,0.04)] backdrop-blur-[24px]">
      <div className="relative aspect-square w-[46%] max-w-[168px] shrink-0 overflow-hidden rounded-[16px] bg-[#eceef0]">
        <ProductMedia product={product} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col py-1">
        <p className="text-[10px] font-bold text-primary">{product.categoryLabel}</p>
        <h3 className="text-[17px] font-bold leading-6 text-[#191c1e]">{product.name}</h3>
        <p className="mt-2 text-xs leading-5 text-[#3e494a]">{product.description}</p>
        <p className="mt-3 text-xl font-extrabold leading-6 text-primary">{product.price}</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6e797a]">{product.stockLabel}</p>
        <Link
          href={product.href}
          className="mt-auto flex min-h-11 w-[132px] items-center justify-center rounded-full bg-primary-gradient px-4 text-xs font-bold text-white shadow-chip"
        >
          {product.cta}
        </Link>
      </div>
    </article>
  );
}

function ProductMedia({ product }: { product: Product }) {
  if (product.imageUrl) {
    return <Image src={product.imageUrl} alt={product.imageAlt} fill sizes="(max-width: 480px) 45vw, 180px" className="object-contain p-2" />;
  }

  if (product.media === "gel") {
    return (
      <div
        role="img"
        aria-label={product.imageAlt}
        className="relative flex h-full w-full items-end justify-center overflow-hidden bg-[radial-gradient(circle_at_25%_18%,rgba(122,213,221,0.35),transparent_24%),linear-gradient(145deg,#0d3438,#09282d_58%,#071c21)]"
      >
        <Sparkles aria-hidden="true" className="absolute left-5 top-5 size-5 text-[#7ad5dd]/70" />
        <div className="absolute inset-x-0 bottom-0 h-12 bg-[#7ad5dd]/10 blur-xl" />
        <div className="relative mb-3 h-[72%] w-[36%] rounded-b-[16px] rounded-t-[8px] bg-[#d9fbff] shadow-[0_12px_24px_rgba(0,0,0,0.25)]">
          <div className="absolute inset-x-0 top-0 h-4 rounded-t-[8px] bg-white" />
          <div className="absolute left-1/2 top-6 h-[58%] w-[58%] -translate-x-1/2 rounded-[10px] bg-[#58d5d4]" />
          <div className="absolute bottom-3 left-1/2 h-2 w-8 -translate-x-1/2 rounded-full bg-[#006067]" />
        </div>
      </div>
    );
  }

  if (product.media === "vitamin") {
    return (
      <div
        role="img"
        aria-label={product.imageAlt}
        className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_58%,#ffb15d_0%,#e95f12_62%,#c9480d_100%)]"
      >
        <div className="absolute bottom-6 h-5 w-24 rounded-full bg-black/20 blur-md" />
        <div className="relative h-[70%] w-[40%] rounded-b-[16px] rounded-t-[10px] bg-[#776f24] shadow-[0_12px_24px_rgba(0,0,0,0.25)]">
          <div className="absolute -top-4 left-1/2 h-5 w-[58%] -translate-x-1/2 rounded-t-[8px] bg-[#252019]" />
          <div className="absolute inset-x-2 top-9 rounded-[6px] bg-white px-1 py-2 text-center">
            <p className="text-[7px] font-bold leading-none text-[#252019]">MULTI-VITAMIN</p>
            <p className="mt-1 text-[4px] leading-none text-[#6e797a]">Clinical supplement</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={product.imageAlt}
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#246c70]"
    >
      <div className="absolute left-5 top-7 size-2 rounded-full bg-[#7ad5dd]/50" />
      <div className="absolute left-9 top-11 size-1 rounded-full bg-white/70" />
      <div className="absolute right-8 top-9 size-2 rounded-full bg-[#7ad5dd]/60" />
      <div className="relative flex items-end gap-2">
        <div className="h-20 w-16 rounded-b-[10px] rounded-t-[18px] bg-[#fff7e4] shadow-[0_10px_20px_rgba(0,0,0,0.2)]">
          <div className="mx-auto mt-5 h-8 w-9 rounded bg-[#ff8b52]" />
        </div>
        <div className="h-24 w-8 rounded-[8px] bg-white shadow-[0_10px_20px_rgba(0,0,0,0.18)]">
          <div className="mx-auto mt-4 h-12 w-4 rounded-full bg-[#ff7063]" />
        </div>
        <div className="h-20 w-8 rounded-[8px] bg-white shadow-[0_10px_20px_rgba(0,0,0,0.18)]">
          <div className="mx-auto mt-3 h-10 w-4 rounded-full bg-[#e4514a]" />
        </div>
      </div>
    </div>
  );
}
