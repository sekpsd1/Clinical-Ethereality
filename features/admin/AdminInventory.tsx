import Link from "next/link";
import { Boxes, PackageCheck, ShieldAlert } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminInventoryForm } from "@/features/admin/AdminInventoryForm";
import type { AdminInventoryData, AdminInventoryItem } from "@/features/admin/inventory/types";

function getStockTone(item: AdminInventoryItem): "neutral" | "success" | "warning" | "danger" {
  if (item.productStatus !== "active") {
    return "neutral";
  }

  if (item.availableQuantity <= 0) {
    return "danger";
  }

  if (item.availableQuantity <= item.lowStockThreshold) {
    return "warning";
  }

  return "success";
}

function getStockLabel(item: AdminInventoryItem): string {
  if (item.productStatus !== "active") {
    return "ไม่ active";
  }

  if (item.availableQuantity <= 0) {
    return "หมด";
  }

  if (item.availableQuantity <= item.lowStockThreshold) {
    return "สต็อกต่ำ";
  }

  return "พร้อมขาย";
}

export function AdminInventory({ data }: { data: AdminInventoryData }) {
  const summaryItems = [
    {
      label: "สต็อกต่ำ",
      value: String(data.summary.lowStock),
      tone: "warning"
    },
    {
      label: "สินค้า active",
      value: String(data.summary.activeProducts),
      tone: "success"
    },
    {
      label: "ต้องใช้ใบสั่งยา",
      value: String(data.summary.prescriptionItems),
      tone: "neutral"
    }
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking">
        <p className="text-label font-bold uppercase text-white/75">Inventory</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">สต็อกสินค้าและยา</h2>
        <p className="mt-2 max-w-[340px] text-sm leading-6 text-white/80">
          ตรวจจำนวนคงคลัง จำนวนที่ถูกจอง และเกณฑ์แจ้งเตือนก่อนกระทบการจัดยา
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {summaryItems.map((item) => (
          <div key={item.label} className="rounded-[8px] border border-border bg-white/85 p-3 shadow-payment-card">
            <p className="font-headline text-2xl font-bold text-text">{item.value}</p>
            <p className="mt-1 min-h-8 text-[10px] font-semibold leading-4 text-muted">{item.label}</p>
            <div className="mt-2">
              <StatusBadge tone={item.tone}>{item.label}</StatusBadge>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-bold text-text">รายการสต็อก</h2>
          <div className="flex items-center gap-2">
            <Link href="/admin/products" className="text-xs font-bold text-primary">
              Products
            </Link>
            <StatusBadge tone={data.unavailable ? "danger" : "success"}>
              {data.unavailable ? "ฐานข้อมูลออฟไลน์" : "พร้อมใช้งาน"}
            </StatusBadge>
          </div>
        </div>

        {data.unavailable ? (
          <EmptyInventory title="ยังไม่ได้เชื่อมต่อฐานข้อมูล" body="ตั้งค่า DATABASE_URL และรัน Prisma schema ก่อนจัดการสต็อก" />
        ) : data.items.length === 0 ? (
          <EmptyInventory title="ยังไม่มีรายการสต็อก" body="สินค้า active พร้อม inventory record จะแสดงที่นี่" />
        ) : null}

        {data.items.map((item) => {
          const tone = getStockTone(item);

          return (
            <article key={item.id} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
              <div className="flex gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <Boxes aria-hidden="true" className="size-5" strokeWidth={2.1} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-text">{item.productName}</h3>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-muted">{item.productSlug}</p>
                    </div>
                    <StatusBadge tone={tone}>{getStockLabel(item)}</StatusBadge>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted">
                    อัปเดตล่าสุด {item.updatedAt}
                    {item.requiresPrescription ? " · ต้องใช้ใบสั่งยา" : ""}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <InfoTile label="พร้อมขาย" value={String(item.availableQuantity)} icon="stock" />
                <InfoTile label="คงคลัง" value={String(item.quantity)} icon="stock" />
                <InfoTile label="จองไว้" value={String(item.reservedQuantity)} icon="reserved" />
              </div>

              <AdminInventoryForm item={item} />
            </article>
          );
        })}
      </section>
    </div>
  );
}

function EmptyInventory({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center">
      <h3 className="text-sm font-bold text-text">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted">{body}</p>
    </div>
  );
}

function InfoTile({ label, value, icon }: { label: string; value: string; icon: "reserved" | "stock" }) {
  const Icon = icon === "reserved" ? ShieldAlert : PackageCheck;

  return (
    <div className="rounded-[8px] bg-primary/5 px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted">
        <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
        <p className="text-[10px] font-bold uppercase">{label}</p>
      </div>
      <p className="mt-0.5 truncate font-bold text-primary">{value}</p>
    </div>
  );
}
