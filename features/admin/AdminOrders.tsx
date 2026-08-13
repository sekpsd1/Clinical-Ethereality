import { ClipboardCheck, ClipboardList, CreditCard, History, MapPin, Phone, Truck } from "lucide-react";
import { InfoTile } from "@/components/ui/InfoTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminOrderActionButtons } from "@/features/admin/AdminOrderActionButtons";
import type { AdminOrderQueueItem, AdminOrdersData } from "@/features/admin/orders/types";
import { formatShippingAddress } from "@/features/profile/shipping-addresses/types";

const orderStatusLabels: Record<string, string> = {
  cancelled: "ยกเลิก",
  delivered: "ส่งถึงแล้ว",
  paid: "ชำระแล้ว",
  payment_review: "รอตรวจสลิป",
  pending_payment: "รอชำระ",
  preparing: "จัดเตรียม",
  refunded: "คืนเงิน",
  shipped: "จัดส่งแล้ว"
};

const shipmentStatusLabels: Record<string, string> = {
  cancelled: "ยกเลิก",
  delivered: "ส่งถึงแล้ว",
  failed: "จัดส่งไม่สำเร็จ",
  pending: "รอจัดเตรียม",
  preparing: "จัดเตรียม",
  shipped: "จัดส่งแล้ว"
};

const paymentStatusLabels: Record<string, string> = {
  no_payment_record: "ไม่มีข้อมูลชำระเงิน",
  pending_review: "รอตรวจสลิป",
  pending_slip: "รอสลิป",
  refunded: "คืนเงินแล้ว",
  rejected: "สลิปไม่ผ่าน",
  verified: "ชำระแล้ว"
};

const fulfillmentActionLabels = {
  "order.mark_delivered": "ยืนยันส่งมอบ",
  "order.mark_preparing": "เริ่มจัดยา",
  "order.mark_shipped": "จัดส่งแล้ว"
} as const;

function getStatusTone(status: AdminOrderQueueItem["status"]): "neutral" | "success" | "warning" | "danger" {
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

export function AdminOrders({ data }: { data: AdminOrdersData }) {
  const summaryItems = [
    {
      label: "รอจัดเตรียม",
      value: String(data.summary.needsPreparation),
      tone: "warning"
    },
    {
      label: "กำลังจัดยา",
      value: String(data.summary.inFulfillment),
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
        <p className="text-label font-bold uppercase text-white/75">จัดการคำสั่งซื้อ</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">คำสั่งซื้อและจัดส่ง</h2>
        <p className="mt-2 max-w-[340px] text-sm leading-6 text-white/80">
          ติดตามคำสั่งซื้อที่ชำระแล้ว เตรียมยา และอัปเดตสถานะจัดส่งด้วยขั้นตอนสั้นที่สุด
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
          <h2 className="font-headline text-lg font-bold text-text">รายการคำสั่งซื้อ</h2>
          <StatusBadge tone={data.unavailable ? "danger" : "success"}>
            {data.unavailable ? "ฐานข้อมูลออฟไลน์" : "พร้อมใช้งาน"}
          </StatusBadge>
        </div>

        {data.unavailable ? (
          <EmptyOrderQueue title="ยังไม่ได้เชื่อมต่อฐานข้อมูล" body="ตั้งค่าฐานข้อมูลและเตรียมโครงสร้างข้อมูลก่อนจัดการคำสั่งซื้อ" />
        ) : data.orders.length === 0 ? (
          <EmptyOrderQueue title="ยังไม่มีคำสั่งซื้อ" body="คำสั่งซื้อจากลูกค้าจะแสดงที่นี่เมื่อมีข้อมูลในระบบ" />
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
                      <p className="mt-0.5 truncate text-sm font-bold text-text">{order.customerName}</p>
                      {order.customerPhone ? (
                        <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] font-semibold text-muted">
                          <Phone aria-hidden="true" className="size-3 shrink-0 text-primary" strokeWidth={2.1} />
                          {order.customerPhone}
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge tone={tone}>{orderStatusLabels[order.status]}</StatusBadge>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted">{order.itemSummary}</p>
                  {order.externalPrescriptionAttachmentCount > 0 ? (
                    <p className="mt-2 rounded-[8px] bg-primary/5 px-3 py-2 text-[11px] font-bold leading-4 text-primary">
                      แนบใบสั่งยา: {order.externalPrescriptionFileName ?? `${order.externalPrescriptionAttachmentCount} ไฟล์`}
                    </p>
                  ) : null}
                  {order.prescriptionDoctorName ? (
                    <div className="mt-2 rounded-[8px] bg-primary/5 px-3 py-2">
                      <p className="flex items-center gap-2 text-[11px] font-bold leading-4 text-primary">
                        <ClipboardCheck aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
                        ใบสั่งยาโดย {order.prescriptionDoctorName ?? "แพทย์"}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-text">
                        {order.prescriptionSummary ?? "ใบสั่งยานี้เชื่อมกับคำสั่งซื้อแล้ว"}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 text-xs">
                <InfoTile label="ยอดรวม" value={order.total} icon={<CreditCard aria-hidden="true" className="size-3.5" strokeWidth={2.1} />} />
              </div>

              <div className="mt-4 rounded-[8px] bg-primary/5 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                  <Truck aria-hidden="true" className="size-4 text-primary" strokeWidth={2.1} />
                  <span className="truncate">
                    {order.shipmentStatus ? shipmentStatusLabels[order.shipmentStatus] : "ยังไม่มีข้อมูลจัดส่ง"}
                    {order.trackingNumber ? ` · ${order.trackingNumber}` : ""}
                  </span>
                </div>
              </div>

              <div className={`mt-3 rounded-[8px] p-3 ${order.shippingAddress ? "bg-primary/5" : "border border-danger/20 bg-danger/5"}`}>
                <p className="flex items-center gap-2 text-[11px] font-bold text-text"><MapPin aria-hidden="true" className="size-3.5 text-primary" />ที่อยู่จัดส่งของคำสั่งซื้อ</p>
                {order.shippingAddress ? <><p className="mt-2 text-xs font-bold text-text">{order.shippingAddress.recipientName} · {order.shippingAddress.phone}</p><p className="mt-1 text-xs leading-5 text-muted">{formatShippingAddress(order.shippingAddress)}</p></> : <p className="mt-2 text-xs font-bold leading-5 text-danger">คำสั่งซื้อเดิมไม่มี snapshot กรุณาตรวจสอบก่อนจัดส่ง</p>}
              </div>

              {order.fulfillmentHistory.length > 0 ? (
                <div className="mt-3 rounded-[8px] border border-border/70 bg-white/70 p-3">
                  <p className="flex items-center gap-2 text-[11px] font-bold text-text">
                    <History aria-hidden="true" className="size-3.5 text-primary" strokeWidth={2.1} />
                    ประวัติผู้ดำเนินการ
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {order.fulfillmentHistory.map((event) => (
                      <p key={`${event.action}-${event.occurredAt}`} className="text-[11px] leading-4 text-muted">
                        {fulfillmentActionLabels[event.action]} · {event.actorName} · {event.occurredAt}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                <p className="min-w-0 truncate text-[11px] font-semibold text-muted">
                  สร้างเมื่อ {order.createdAt} · ชำระเงิน {paymentStatusLabels[order.paymentStatus] ?? order.paymentStatus}
                </p>
                <AdminOrderActionButtons order={order} />
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
