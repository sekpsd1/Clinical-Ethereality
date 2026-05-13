import Link from "next/link";
import { ArrowUpRight, PackageCheck, Pill, Tags } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminProductForm } from "@/features/admin/AdminProductForm";
import type { AdminProductItem, AdminProductsData } from "@/features/admin/products/types";

function getStatusTone(status: AdminProductItem["status"]): "neutral" | "success" | "warning" | "danger" {
  if (status === "active") {
    return "success";
  }

  if (status === "draft") {
    return "warning";
  }

  return "danger";
}

export function AdminProducts({ data }: { data: AdminProductsData }) {
  const summaryItems = [
    {
      label: "Active",
      value: String(data.summary.active),
      tone: "success"
    },
    {
      label: "Draft",
      value: String(data.summary.draft),
      tone: "warning"
    },
    {
      label: "Rx",
      value: String(data.summary.prescriptionRequired),
      tone: "neutral"
    }
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking">
        <p className="text-label font-bold uppercase text-white/75">Product Catalog</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">Products and medicine</h2>
        <p className="mt-2 max-w-[340px] text-sm leading-6 text-white/80">
          Manage product names, pricing, prescription requirements, and catalog status before inventory is prepared.
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
          <h2 className="font-headline text-lg font-bold text-text">Create product</h2>
          <Link href="/admin/inventory" className="inline-flex items-center gap-1 text-xs font-bold text-primary">
            Stock
            <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2.1} />
          </Link>
        </div>
        <AdminProductForm />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-bold text-text">Catalog</h2>
          <StatusBadge tone={data.unavailable ? "danger" : "success"}>
            {data.unavailable ? "Database offline" : "Ready"}
          </StatusBadge>
        </div>

        {data.unavailable ? (
          <EmptyProductCatalog
            title="Database is not connected"
            body="Set DATABASE_URL and run the Prisma schema before managing product catalog."
          />
        ) : data.products.length === 0 ? (
          <EmptyProductCatalog title="No products yet" body="Create the first product above, then manage stock from inventory." />
        ) : null}

        {data.products.map((product) => {
          const tone = getStatusTone(product.status);

          return (
            <article key={product.id} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
              <div className="flex gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <Tags aria-hidden="true" className="size-5" strokeWidth={2.1} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-text">{product.name}</h3>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-muted">{product.slug}</p>
                    </div>
                    <StatusBadge tone={tone}>{product.status}</StatusBadge>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted">
                    {product.description || "No description yet."}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <InfoTile label="Price" value={`฿${product.price}`} icon="product" />
                <InfoTile label="Stock" value={product.inventoryQuantity === null ? "None" : String(product.inventoryQuantity)} icon="product" />
                <InfoTile label="Rx" value={product.requiresPrescription ? "Required" : "No"} icon="rx" />
              </div>

              <p className="mt-3 truncate border-t border-border/70 pt-3 text-[11px] font-semibold text-muted">
                Updated {product.updatedAt}
              </p>
              <div className="mt-4">
                <AdminProductForm product={product} />
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function EmptyProductCatalog({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center">
      <h3 className="text-sm font-bold text-text">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted">{body}</p>
    </div>
  );
}

function InfoTile({ label, value, icon }: { label: string; value: string; icon: "product" | "rx" }) {
  const Icon = icon === "rx" ? Pill : PackageCheck;

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
