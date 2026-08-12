"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Boxes, ImageIcon, Pencil, RotateCcw, Search, X } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminInventoryForm } from "@/features/admin/AdminInventoryForm";
import { AdminProductTabs } from "@/features/admin/AdminProductTabs";
import {
  defaultAdminInventoryFilters,
  filterAdminInventoryItems,
  isLowStockInventoryItem,
  type AdminInventoryFilters,
  type InventoryStatusFilter,
  type InventoryStockFilter
} from "@/features/admin/inventory/filters";
import { productCategories, type ProductCategory } from "@/features/products/categories";
import { cn } from "@/lib/design-system/variants";
import type { AdminInventoryData, AdminInventoryItem } from "@/features/admin/inventory/types";

const productStatusLabels: Record<AdminInventoryItem["productStatus"], string> = {
  active: "เผยแพร่",
  archived: "เก็บถาวร",
  draft: "ฉบับร่าง"
};

function getStockTone(item: AdminInventoryItem): "neutral" | "success" | "warning" | "danger" {
  if (item.productStatus !== "active") {
    return "neutral";
  }

  if (item.availableQuantity <= 0) {
    return "danger";
  }

  if (isLowStockInventoryItem(item)) {
    return "warning";
  }

  return "success";
}

function getStockLabel(item: AdminInventoryItem): string {
  if (item.productStatus !== "active") {
    return productStatusLabels[item.productStatus];
  }

  if (item.availableQuantity <= 0) {
    return "หมดสต็อก";
  }

  if (isLowStockInventoryItem(item)) {
    return "สต็อกต่ำ";
  }

  return "พร้อมขาย";
}

export function AdminInventory({ data }: { data: AdminInventoryData }) {
  const [filters, setFilters] = useState<AdminInventoryFilters>(defaultAdminInventoryFilters);
  const [editorItem, setEditorItem] = useState<AdminInventoryItem | null>(null);
  const filteredItems = useMemo(() => filterAdminInventoryItems(data.items, filters), [data.items, filters]);
  const filteredSummary = useMemo(
    () => ({
      available: filteredItems.filter((item) => item.availableQuantity > 0).length,
      lowStock: filteredItems.filter(isLowStockInventoryItem).length,
      visible: filteredItems.length
    }),
    [filteredItems]
  );

  useEffect(() => {
    if (!editorItem) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditorItem(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorItem]);

  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking lg:mx-0 lg:rounded-[14px] lg:px-6">
        <p className="text-label font-bold uppercase text-white/75">สินค้า</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">สต็อกสินค้า</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
          ตรวจคงคลัง จำนวนที่จอง พร้อมขาย และเกณฑ์เตือนต่ำจากจุดจัดการสินค้าเดียวกัน
        </p>
      </section>

      <AdminProductTabs active="inventory" />

      <section className="grid grid-cols-3 gap-2" aria-label="สรุปสต็อกที่แสดง">
        <InventorySummary label="กำลังแสดง" value={filteredSummary.visible} />
        <InventorySummary label="สต็อกต่ำ" value={filteredSummary.lowStock} tone="warning" />
        <InventorySummary label="มีพร้อมขาย" value={filteredSummary.available} tone="success" />
      </section>

      <InventoryFilters filters={filters} onChange={setFilters} resultCount={filteredItems.length} />

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-headline text-lg font-bold text-text">รายการสต็อก</h2>
            <p className="mt-0.5 text-xs font-semibold text-muted">
              ค่าเริ่มต้นแสดงเฉพาะสินค้าที่เผยแพร่และไม่ใช่ Test/UAT
            </p>
          </div>
          {data.unavailable ? <StatusBadge tone="danger">ฐานข้อมูลออฟไลน์</StatusBadge> : null}
        </div>

        {data.unavailable ? (
          <EmptyInventory title="ยังไม่ได้เชื่อมต่อฐานข้อมูล" body="ตั้งค่าฐานข้อมูลก่อนจัดการสต็อกสินค้า" />
        ) : data.items.length === 0 ? (
          <EmptyInventory title="ยังไม่มีรายการสต็อก" body="สร้างสินค้าในแคตตาล็อกเพื่อเริ่มจัดการสต็อก" />
        ) : filteredItems.length === 0 ? (
          <EmptyInventory
            title="ไม่พบสินค้าที่ตรงกับตัวกรอง"
            body="ลองเปลี่ยนคำค้น หมวดหมู่ สถานะ หรือล้างตัวกรองเพื่อดูรายการอื่น"
            onReset={() => setFilters(defaultAdminInventoryFilters)}
          />
        ) : (
          <>
            <InventoryDesktopTable items={filteredItems} onEdit={setEditorItem} />
            <div className="grid gap-3 lg:hidden">
              {filteredItems.map((item) => (
                <InventoryMobileCard key={item.id} item={item} onEdit={() => setEditorItem(item)} />
              ))}
            </div>
          </>
        )}
      </section>

      {editorItem ? <InventoryEditorPanel item={editorItem} onClose={() => setEditorItem(null)} /> : null}
    </div>
  );
}

function InventorySummary({
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

function InventoryFilters({
  filters,
  onChange,
  resultCount
}: {
  filters: AdminInventoryFilters;
  onChange: (filters: AdminInventoryFilters) => void;
  resultCount: number;
}) {
  const hasCustomFilters =
    filters.query !== defaultAdminInventoryFilters.query ||
    filters.category !== defaultAdminInventoryFilters.category ||
    filters.status !== defaultAdminInventoryFilters.status ||
    filters.stock !== defaultAdminInventoryFilters.stock ||
    filters.includeTestItems !== defaultAdminInventoryFilters.includeTestItems;

  return (
    <section className="rounded-[8px] border border-border bg-white/85 p-3 shadow-payment-card" aria-label="ตัวกรองสต็อก">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_1fr_1fr_1fr]">
        <label className="relative sm:col-span-2 xl:col-span-1">
          <span className="sr-only">ค้นหาสินค้า</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-muted" strokeWidth={2} />
          <input
            className="h-10 w-full rounded-[8px] border border-border bg-white pl-9 pr-3 text-sm font-semibold text-text outline-none transition focus:border-primary"
            type="search"
            value={filters.query}
            placeholder="ค้นหาชื่อหรือ slug"
            onChange={(event) => onChange({ ...filters, query: event.currentTarget.value })}
          />
        </label>
        <FilterSelect
          ariaLabel="กรองหมวดหมู่"
          value={filters.category}
          onChange={(value) => onChange({ ...filters, category: value as ProductCategory | "" })}
          options={[
            { label: "ทุกหมวดหมู่", value: "" },
            ...productCategories.map((category) => ({ label: category.label, value: category.value }))
          ]}
        />
        <FilterSelect
          ariaLabel="กรองสถานะสินค้า"
          value={filters.status}
          onChange={(value) => onChange({ ...filters, status: value as InventoryStatusFilter })}
          options={[
            { label: "สถานะ: เผยแพร่", value: "active" },
            { label: "สถานะ: ฉบับร่าง", value: "draft" },
            { label: "สถานะ: เก็บถาวร", value: "archived" },
            { label: "ทุกสถานะ", value: "all" }
          ]}
        />
        <FilterSelect
          ariaLabel="กรองสถานะสต็อก"
          value={filters.stock}
          onChange={(value) => onChange({ ...filters, stock: value as InventoryStockFilter })}
          options={[
            { label: "สต็อก: ทั้งหมด", value: "all" },
            { label: "เฉพาะสต็อกต่ำ", value: "low" },
            { label: "เฉพาะหมดสต็อก", value: "out" },
            { label: "เฉพาะมีพร้อมขาย", value: "available" }
          ]}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
        <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-[8px] bg-surface px-3 text-xs font-bold text-muted">
          <input
            type="checkbox"
            className="size-4 rounded border-border text-primary"
            checked={filters.includeTestItems}
            onChange={(event) => onChange({ ...filters, includeTestItems: event.currentTarget.checked })}
          />
          รวมรายการ Test/UAT
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted">พบ {resultCount} รายการ</span>
          {hasCustomFilters ? (
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] px-3 text-xs font-bold text-primary hover:bg-primary/5"
              onClick={() => onChange(defaultAdminInventoryFilters)}
            >
              <RotateCcw aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
              ค่าเริ่มต้น
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function FilterSelect({
  ariaLabel,
  onChange,
  options,
  value
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      className="h-10 w-full rounded-[8px] border border-border bg-white px-3 text-xs font-bold text-text outline-none transition focus:border-primary"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function InventoryDesktopTable({
  items,
  onEdit
}: {
  items: AdminInventoryItem[];
  onEdit: (item: AdminInventoryItem) => void;
}) {
  return (
    <div className="hidden overflow-x-auto rounded-[8px] border border-border bg-white/90 shadow-payment-card lg:block">
      <table className="w-full min-w-[920px] border-collapse text-left">
        <thead className="bg-surface/80 text-[11px] font-bold text-muted">
          <tr>
            <th className="w-16 px-3 py-3" scope="col">รูป</th>
            <th className="min-w-64 px-3 py-3" scope="col">สินค้า</th>
            <th className="px-3 py-3 text-right" scope="col">คงคลัง</th>
            <th className="px-3 py-3 text-right" scope="col">จอง</th>
            <th className="px-3 py-3 text-right" scope="col">พร้อมขาย</th>
            <th className="px-3 py-3 text-right" scope="col">เตือนต่ำ</th>
            <th className="w-24 px-3 py-3 text-center" scope="col">แก้ไข</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {items.map((item) => (
            <tr key={item.id} className="text-sm text-text transition-colors hover:bg-primary/[0.025]">
              <td className="px-3 py-2.5">
                <ProductThumbnail item={item} size="small" />
              </td>
              <td className="px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="min-w-0">
                    <p className="max-w-sm truncate font-bold">{item.productName}</p>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-muted">{item.productCategoryLabel}</p>
                  </div>
                  <StatusBadge tone={getStockTone(item)}>{getStockLabel(item)}</StatusBadge>
                </div>
              </td>
              <InventoryNumberCell value={item.quantity} />
              <InventoryNumberCell value={item.reservedQuantity} />
              <InventoryNumberCell value={item.availableQuantity} emphasize />
              <InventoryNumberCell value={item.lowStockThreshold} />
              <td className="px-3 py-2.5 text-center">
                <EditInventoryButton item={item} onEdit={() => onEdit(item)} compact />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InventoryNumberCell({ value, emphasize = false }: { value: number; emphasize?: boolean }) {
  return (
    <td className={cn("px-3 py-2.5 text-right tabular-nums", emphasize && "font-bold text-primary")}>
      {new Intl.NumberFormat("th-TH").format(value)}
    </td>
  );
}

function InventoryMobileCard({ item, onEdit }: { item: AdminInventoryItem; onEdit: () => void }) {
  return (
    <article className="rounded-[8px] border border-border bg-white/90 p-3 shadow-payment-card">
      <div className="flex gap-3">
        <ProductThumbnail item={item} size="large" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-sm font-bold leading-5 text-text">{item.productName}</h3>
              <p className="mt-0.5 truncate text-[11px] font-semibold text-muted">{item.productCategoryLabel}</p>
            </div>
            <StatusBadge tone={getStockTone(item)}>{getStockLabel(item)}</StatusBadge>
          </div>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-4 gap-1.5 border-y border-border/70 py-3 text-center">
        <StockMetric label="คงคลัง" value={item.quantity} />
        <StockMetric label="จอง" value={item.reservedQuantity} />
        <StockMetric label="พร้อมขาย" value={item.availableQuantity} emphasize />
        <StockMetric label="เตือนต่ำ" value={item.lowStockThreshold} />
      </dl>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="truncate text-[10px] font-semibold text-muted">อัปเดต {item.updatedAt}</p>
        <EditInventoryButton item={item} onEdit={onEdit} />
      </div>
    </article>
  );
}

function StockMetric({ label, value, emphasize = false }: { label: string; value: number; emphasize?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[9px] font-bold text-muted">{label}</dt>
      <dd className={cn("mt-1 text-sm font-bold tabular-nums text-text", emphasize && "text-primary")}>{value}</dd>
    </div>
  );
}

function ProductThumbnail({ item, size }: { item: AdminInventoryItem; size: "small" | "large" }) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-[8px] bg-surface",
        size === "small" ? "size-11" : "size-16"
      )}
    >
      {item.productImageUrl ? (
        <Image
          src={item.productImageUrl}
          alt=""
          fill
          sizes={size === "small" ? "44px" : "64px"}
          className="object-contain p-1"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-primary/40">
          <ImageIcon aria-hidden="true" className={size === "small" ? "size-5" : "size-7"} strokeWidth={1.8} />
        </div>
      )}
    </div>
  );
}

function EditInventoryButton({
  compact = false,
  item,
  onEdit
}: {
  compact?: boolean;
  item: AdminInventoryItem;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[8px] bg-primary/10 px-3 text-xs font-bold text-primary",
        compact && "size-9 min-h-0 p-0"
      )}
      onClick={onEdit}
      aria-label={`แก้ไขสต็อก ${item.productName}`}
      title={`แก้ไขสต็อก ${item.productName}`}
    >
      <Pencil aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
      {compact ? null : "แก้ไขสต็อก"}
    </button>
  );
}

function InventoryEditorPanel({ item, onClose }: { item: AdminInventoryItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-text/35 backdrop-blur-[2px]" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="inventory-editor-title"
        aria-modal="true"
        className="h-full w-full overflow-y-auto bg-app shadow-glass sm:max-w-xl"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-white/90 px-4 py-3 backdrop-blur-topbar sm:px-5">
          <div className="min-w-0">
            <p className="text-label font-bold uppercase text-primary">แก้ไขสต็อก</p>
            <h2 id="inventory-editor-title" className="truncate font-headline text-lg font-bold text-text">
              {item.productName}
            </h2>
          </div>
          <button
            type="button"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-muted"
            onClick={onClose}
            aria-label="ปิดแผงแก้ไขสต็อก"
          >
            <X aria-hidden="true" className="size-5" strokeWidth={2.1} />
          </button>
        </header>
        <div className="p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:p-5">
          <div className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
            <div className="flex items-center gap-3">
              <ProductThumbnail item={item} size="large" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-text">{item.productName}</p>
                <p className="mt-1 text-xs font-semibold text-muted">จองแล้ว {item.reservedQuantity} · พร้อมขาย {item.availableQuantity}</p>
              </div>
            </div>
            <AdminInventoryForm item={item} onSaved={onClose} />
          </div>
        </div>
      </section>
    </div>
  );
}

function EmptyInventory({
  body,
  onReset,
  title
}: {
  body: string;
  onReset?: () => void;
  title: string;
}) {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-6 text-center">
      <Boxes aria-hidden="true" className="mx-auto size-8 text-primary/45" strokeWidth={1.8} />
      <h3 className="mt-3 text-sm font-bold text-text">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted">{body}</p>
      {onReset ? (
        <button type="button" className="mt-3 text-xs font-bold text-primary" onClick={onReset}>
          กลับสู่ค่าเริ่มต้น
        </button>
      ) : null}
    </div>
  );
}
