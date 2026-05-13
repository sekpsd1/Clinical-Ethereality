import { ClipboardList, CreditCard, PackageCheck, Truck } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PharmacistOrderActionButtons } from "@/features/pharmacist/PharmacistOrderActionButtons";
import type { PharmacistOrderQueueItem, PharmacistOrdersData } from "@/features/pharmacist/orders/types";

const orderStatusLabels: Record<string, string> = {
  cancelled: "Cancelled",
  delivered: "Delivered",
  paid: "Paid",
  payment_review: "Payment review",
  pending_payment: "Pending payment",
  preparing: "Preparing",
  refunded: "Refunded",
  shipped: "Shipped"
};

const shipmentStatusLabels: Record<string, string> = {
  cancelled: "Cancelled",
  delivered: "Delivered",
  failed: "Failed",
  pending: "Pending",
  preparing: "Preparing",
  shipped: "Shipped"
};

function getStatusTone(status: PharmacistOrderQueueItem["status"]): "neutral" | "success" | "warning" | "danger" {
  if (status === "delivered") {
    return "success";
  }

  if (status === "paid" || status === "payment_review" || status === "pending_payment") {
    return "warning";
  }

  if (status === "cancelled" || status === "refunded") {
    return "danger";
  }

  return "neutral";
}

export function PharmacistOrders({ data }: { data: PharmacistOrdersData }) {
  const summaryItems = [
    {
      label: "Ready",
      value: String(data.summary.needsPreparation),
      tone: "warning"
    },
    {
      label: "Preparing",
      value: String(data.summary.inPreparation),
      tone: "neutral"
    },
    {
      label: "Shipped",
      value: String(data.summary.shipped),
      tone: "success"
    }
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking">
        <p className="text-label font-bold uppercase text-white/75">Medicine Preparation</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">Pharmacy order queue</h2>
        <p className="mt-2 max-w-[340px] text-sm leading-6 text-white/80">
          Move paid medicine orders through preparation, shipment, and delivery with a short pharmacist workflow.
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
          <h2 className="font-headline text-lg font-bold text-text">Orders</h2>
          <StatusBadge tone={data.unavailable ? "danger" : "success"}>
            {data.unavailable ? "Database offline" : "Ready"}
          </StatusBadge>
        </div>

        {data.unavailable ? (
          <EmptyOrderQueue
            title="Database is not connected"
            body="Set DATABASE_URL and run the Prisma schema before managing medicine preparation."
          />
        ) : data.orders.length === 0 ? (
          <EmptyOrderQueue title="No medicine orders yet" body="Paid orders that need pharmacy preparation will appear here." />
        ) : null}

        {data.orders.map((order) => {
          const tone = getStatusTone(order.status);

          return (
            <article key={order.id} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
              <div className="flex gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <ClipboardList aria-hidden="true" className="size-5" strokeWidth={2.1} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-text">{order.orderCode}</h3>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-muted">{order.customerName}</p>
                    </div>
                    <StatusBadge tone={tone}>{orderStatusLabels[order.status]}</StatusBadge>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted">{order.itemSummary}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <InfoTile label="Total" value={order.total} icon="payment" />
                <InfoTile label="LINE" value={order.customerLineId} icon="order" />
              </div>

              <div className="mt-4 rounded-[8px] bg-primary/5 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                  <Truck aria-hidden="true" className="size-4 text-primary" strokeWidth={2.1} />
                  <span className="truncate">
                    {order.shipmentStatus ? shipmentStatusLabels[order.shipmentStatus] : "No shipment record yet"}
                    {order.trackingNumber ? ` / ${order.trackingNumber}` : ""}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                <p className="min-w-0 truncate text-[11px] font-semibold text-muted">
                  Created {order.createdAt} / Payment {order.paymentStatus}
                </p>
                <PharmacistOrderActionButtons order={order} />
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function EmptyOrderQueue({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center">
      <h3 className="text-sm font-bold text-text">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted">{body}</p>
    </div>
  );
}

function InfoTile({ label, value, icon }: { label: string; value: string; icon: "order" | "payment" }) {
  const Icon = icon === "payment" ? CreditCard : PackageCheck;

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
