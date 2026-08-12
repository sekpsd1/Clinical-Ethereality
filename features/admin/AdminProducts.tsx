"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ImageIcon, PackagePlus, Pencil, Plus, X } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminProductArchiveButton } from "@/features/admin/AdminProductArchiveButton";
import { AdminProductForm } from "@/features/admin/AdminProductForm";
import { productCategories } from "@/features/products/categories";
import { cn } from "@/lib/design-system/variants";
import type { AdminProductItem, AdminProductsData } from "@/features/admin/products/types";

const productStatusLabels: Record<AdminProductItem["status"], string> = {
  active: "เผยแพร่",
  archived: "เก็บถาวร",
  draft: "ฉบับร่าง"
};

function getStatusTone(status: AdminProductItem["status"]): "neutral" | "success" | "warning" {
  if (status === "active") {
    return "success";
  }

  if (status === "draft") {
    return "warning";
  }

  return "neutral";
}

function getStockBadge(product: AdminProductItem): {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger";
} {
  if (product.inventoryAvailableQuantity === null) {
    return { label: "ยังไม่มีสต็อก", tone: "neutral" };
  }

  if (product.inventoryAvailableQuantity <= 0) {
    return { label: "หมดสต็อก", tone: "danger" };
  }

  if (
    product.inventoryLowStockThreshold !== null &&
    product.inventoryAvailableQuantity <= product.inventoryLowStockThreshold
  ) {
    return { label: `เหลือ ${product.inventoryAvailableQuantity}`, tone: "warning" };
  }

  return { label: `สต็อก ${product.inventoryAvailableQuantity}`, tone: "success" };
}

export function AdminProducts({ data }: { data: AdminProductsData }) {
  const [editorProduct, setEditorProduct] = useState<AdminProductItem | null | undefined>(undefined);
  const groupedProducts = useMemo(
    () =>
      productCategories
        .map((category) => ({
          ...category,
          products: data.products.filter((product) => product.category === category.value)
        }))
        .filter((category) => category.products.length > 0),
    [data.products]
  );
  const isEditorOpen = editorProduct !== undefined;

  useEffect(() => {
    if (!isEditorOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditorProduct(undefined);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditorOpen]);

  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking lg:mx-0 lg:rounded-[14px] lg:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-label font-bold uppercase text-white/75">แคตตาล็อกสินค้า</p>
            <h2 className="mt-1 font-headline text-2xl font-bold">สินค้าและยา</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
              จัดการรายการสินค้าแยกตามหมวดหมู่ และไปหน้าสต็อกเพื่อปรับจำนวนพร้อมขาย
            </p>
          </div>
          <button
            type="button"
            className="hidden min-h-11 shrink-0 items-center gap-2 rounded-[8px] bg-white px-4 text-sm font-bold text-primary shadow-chip sm:inline-flex"
            onClick={() => setEditorProduct(null)}
          >
            <Plus aria-hidden="true" className="size-4" strokeWidth={2.3} />
            เพิ่มสินค้า
          </button>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2" aria-label="สรุปแคตตาล็อก">
        <CatalogSummary label="ทั้งหมด" value={data.products.length} />
        <CatalogSummary label="เผยแพร่" value={data.summary.active} tone="success" />
        <CatalogSummary label="ฉบับร่าง" value={data.summary.draft} tone="warning" />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-headline text-lg font-bold text-text">รายการสินค้า</h2>
            <p className="mt-0.5 text-xs font-semibold text-muted">{data.products.length} รายการในแคตตาล็อก</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/inventory"
              className="inline-flex min-h-10 items-center gap-1 whitespace-nowrap rounded-[8px] px-2 text-xs font-bold text-primary hover:bg-primary/5 sm:px-3"
            >
              จัดการสต็อก
              <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2.1} />
            </Link>
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-[8px] bg-primary px-3 text-xs font-bold text-white sm:hidden"
              onClick={() => setEditorProduct(null)}
            >
              <Plus aria-hidden="true" className="size-4" strokeWidth={2.3} />
              เพิ่มสินค้า
            </button>
          </div>
        </div>

        {data.unavailable ? (
          <EmptyProductCatalog
            title="ยังเชื่อมต่อฐานข้อมูลไม่ได้"
            body="ตั้งค่าฐานข้อมูลและเตรียมโครงสร้างข้อมูลก่อนจัดการแคตตาล็อกสินค้า"
          />
        ) : data.products.length === 0 ? (
          <EmptyProductCatalog title="ยังไม่มีสินค้า" body="กดเพิ่มสินค้าเพื่อสร้างรายการแรก แล้วจัดการจำนวนจากหน้าสต็อก" />
        ) : (
          groupedProducts.map((category) => (
            <section key={category.value} className="flex flex-col gap-3" aria-labelledby={`category-${category.value}`}>
              <div className="flex items-center gap-2 border-b border-border/70 pb-2">
                <h3 id={`category-${category.value}`} className="font-headline text-base font-bold text-text">
                  {category.label}
                </h3>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {category.products.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {category.products.map((product) => (
                  <ProductCatalogCard key={product.id} product={product} onEdit={() => setEditorProduct(product)} />
                ))}
              </div>
            </section>
          ))
        )}
      </section>

      {isEditorOpen ? (
        <ProductEditorPanel product={editorProduct} onClose={() => setEditorProduct(undefined)} />
      ) : null}
    </div>
  );
}

function CatalogSummary({
  label,
  tone = "neutral",
  value
}: {
  label: string;
  tone?: "neutral" | "success" | "warning";
  value: number;
}) {
  return (
    <div className="rounded-[8px] border border-border bg-white/85 p-3 shadow-payment-card">
      <p className="font-headline text-2xl font-bold text-text">{value}</p>
      <div className="mt-1">
        <StatusBadge tone={tone}>{label}</StatusBadge>
      </div>
    </div>
  );
}

function ProductCatalogCard({ product, onEdit }: { product: AdminProductItem; onEdit: () => void }) {
  const stockBadge = getStockBadge(product);

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-[8px] border border-border bg-white/90 shadow-payment-card",
        product.status === "archived" && "opacity-70"
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 240px"
            className="object-contain p-3 transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-primary/45">
            <ImageIcon aria-hidden="true" className="size-9" strokeWidth={1.7} />
          </div>
        )}
        <div className="absolute left-2 top-2 flex max-w-[calc(100%-1rem)] flex-wrap gap-1">
          <StatusBadge tone={getStatusTone(product.status)}>{productStatusLabels[product.status]}</StatusBadge>
          <StatusBadge tone={stockBadge.tone}>{stockBadge.label}</StatusBadge>
        </div>
      </div>

      <div className="p-3">
        <h4 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-text">{product.name}</h4>
        <p className="mt-1 truncate text-xs font-semibold text-muted">
          {new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(Number(product.price))} บาท
        </p>
        {product.requiresPrescription ? (
          <p className="mt-2 text-[10px] font-bold text-primary">ต้องใช้ใบสั่งยา</p>
        ) : null}

        <div className="mt-3 flex flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row">
          <button
            type="button"
            className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-primary/10 px-2 text-xs font-bold text-primary"
            onClick={onEdit}
            aria-label={`แก้ไข ${product.name}`}
          >
            <Pencil aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
            แก้ไข
          </button>
          {product.status !== "archived" ? <AdminProductArchiveButton product={product} /> : null}
        </div>
      </div>
    </article>
  );
}

function ProductEditorPanel({
  onClose,
  product
}: {
  onClose: () => void;
  product: AdminProductItem | null;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-text/35 backdrop-blur-[2px]" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="product-editor-title"
        aria-modal="true"
        className="h-full w-full overflow-y-auto bg-app shadow-glass sm:max-w-xl"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-white/90 px-4 py-3 backdrop-blur-topbar sm:px-5">
          <div className="min-w-0">
            <p className="text-label font-bold uppercase text-primary">{product ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</p>
            <h2 id="product-editor-title" className="truncate font-headline text-lg font-bold text-text">
              {product?.name ?? "สร้างรายการใหม่"}
            </h2>
          </div>
          <button
            type="button"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-muted"
            onClick={onClose}
            aria-label="ปิดแผงสินค้า"
          >
            <X aria-hidden="true" className="size-5" strokeWidth={2.1} />
          </button>
        </header>
        <div className="p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:p-5">
          <AdminProductForm key={product?.id ?? "new"} product={product ?? undefined} onSaved={onClose} />
        </div>
      </section>
    </div>
  );
}

function EmptyProductCatalog({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-6 text-center">
      <PackagePlus aria-hidden="true" className="mx-auto size-8 text-primary/50" strokeWidth={1.8} />
      <h3 className="mt-3 text-sm font-bold text-text">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted">{body}</p>
    </div>
  );
}
