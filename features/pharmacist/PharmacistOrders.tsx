import { ClipboardList, CreditCard, PackageCheck, Truck } from "lucide-react";
import { InfoTile } from "@/components/ui/InfoTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PharmacistOrderActionButtons } from "@/features/pharmacist/PharmacistOrderActionButtons";
import type { PharmacistOrderQueueItem, PharmacistOrdersData } from "@/features/pharmacist/orders/types";

const orderStatusLabels: Record<string, string> = {
  cancelled: "ยกเลิกแล้ว",
  delivered: "ส่งสำเร็จ",
  paid: "พร้อมจัดเตรียม",
  payment_review: "รอตรวจสลิป",
  pending_payment: "รอชำระเงิน",
  preparing: "กำลังจัดเตรียม",
  refunded: "คืนเงินแล้ว",
  shipped: "จัดส่งแล้ว"
};

const shipmentStatusLabels: Record<string, string> = {
  cancelled: "ยกเลิกจัดส่ง",
  delivered: "ส่งสำเร็จ",
  failed: "จัดส่งไม่สำเร็จ",
  pending: "รอสร้างรายการจัดส่ง",
  preparing: "กำลังจัดเตรียมพัสดุ",
  shipped: "ส่งออกแล้ว"
};

const paymentStatusLabels: Record<string, string> = {
  no_payment_record: "ไม่มีข้อมูลชำระเงิน",
  pending_review: "รอตรวจสลิป",
  pending_slip: "รอสลิป",
  refunded: "คืนเงินแล้ว",
  rejected: "สลิปไม่ผ่าน",
  verified: "ชำระแล้ว"
};

function getStatusTone(status: PharmacistOrderQueueItem["status"]): "neutral" | "success" | "warning" | "danger" {
  if (status === "delivered" || status === "shipped") {
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
      label: "พร้อมจัดเตรียม",
      value: String(data.summary.needsPreparation),
      tone: "warning"
    },
    {
      label: "กำลังจัดเตรียม",
      value: String(data.summary.inPreparation),
      tone: "neutral"
    },
    {
      label: "จัดส่งแล้ว",
      value: String(data.summary.shipped),
      tone: "success"
    }
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking">
        <p className="text-label font-bold uppercase text-white/75">จัดเตรียมยา</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">คิวจัดเตรียมยา</h2>
        <p className="mt-2 max-w-[340px] text-sm leading-6 text-white/80">
          ติดตามออเดอร์ที่ชำระแล้วจากขั้นตอนจัดเตรียมยา ส่งออก และส่งสำเร็จ โดยไม่เพิ่มขั้นตอนตรวจเอกสารหลังแนบใบสั่งยา
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
          <h2 className="font-headline text-lg font-bold text-text">รายการออเดอร์</h2>
          <StatusBadge tone={data.unavailable ? "danger" : "success"}>
            {data.unavailable ? "ฐานข้อมูลไม่พร้อม" : "พร้อมใช้งาน"}
          </StatusBadge>
        </div>

        {data.unavailable ? (
          <EmptyOrderQueue
            title="ยังเชื่อมต่อฐานข้อมูลไม่ได้"
            body="ตั้งค่าฐานข้อมูลและเตรียมโครงสร้างข้อมูลก่อนจัดการคิวจัดเตรียมยา"
          />
        ) : data.orders.length === 0 ? (
          <EmptyOrderQueue title="ยังไม่มีออเดอร์ยา" body="ออเดอร์ที่ชำระแล้วและต้องจัดเตรียมยาจะแสดงในหน้านี้" />
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
                  {order.externalPrescriptionAttachmentCount > 0 ? (
                    <p className="mt-2 rounded-[8px] bg-primary/5 px-3 py-2 text-[11px] font-bold leading-4 text-primary">
                      แนบใบสั่งยาแล้ว:{" "}
                      {order.externalPrescriptionFileName ?? `${order.externalPrescriptionAttachmentCount} ไฟล์`}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <InfoTile label="ยอดรวม" value={order.total} icon={<CreditCard aria-hidden="true" className="size-3.5" strokeWidth={2.1} />} />
                <InfoTile label="LINE" value={order.customerLineId} icon={<PackageCheck aria-hidden="true" className="size-3.5" strokeWidth={2.1} />} />
              </div>

              <div className="mt-4 rounded-[8px] bg-primary/5 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                  <Truck aria-hidden="true" className="size-4 text-primary" strokeWidth={2.1} />
                  <span className="truncate">
                    {order.shipmentStatus ? shipmentStatusLabels[order.shipmentStatus] : "ยังไม่มีรายการจัดส่ง"}
                    {order.trackingNumber ? ` / ${order.trackingNumber}` : ""}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                <p className="min-w-0 truncate text-[11px] font-semibold text-muted">
                  สร้างเมื่อ {order.createdAt} / ชำระเงิน {paymentStatusLabels[order.paymentStatus]}
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
