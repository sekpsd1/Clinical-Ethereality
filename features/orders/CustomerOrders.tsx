import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Check, PackageCheck, ReceiptText, Truck } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CustomerSlipVerification } from "@/features/orders/CustomerSlipVerification";
import type { CustomerOrderItem, CustomerOrdersData, CustomerOrderTrackingStep } from "@/features/orders/types";

export function CustomerOrders({ data }: { data: CustomerOrdersData }) {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#f7f9fb] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <OrderHeader />

      <main className="mx-auto w-full max-w-mobile space-y-7 px-6 py-7">
        <section className="rounded-[24px] border border-white/40 bg-white/70 p-6 shadow-[0_10px_30px_rgba(0,96,103,0.08)] backdrop-blur-[24px]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/70">Order Tracking</p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-primary">คำสั่งซื้อของฉัน</h1>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <SummaryTile label="กำลังดำเนินการ" value={data.summary.active} />
            <SummaryTile label="รอตรวจสอบ" value={data.summary.paymentReview} />
            <SummaryTile label="สำเร็จ" value={data.summary.completed} />
          </div>
        </section>

        {data.unavailable ? (
          <EmptyOrders title="ไม่สามารถโหลดคำสั่งซื้อได้" body="กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล" />
        ) : null}

        {!data.unavailable && data.orders.length === 0 ? (
          <EmptyOrders title="ยังไม่มีคำสั่งซื้อ" body="เมื่อซื้อสินค้าหรือเวชภัณฑ์ รายการติดตามจะแสดงที่นี่" />
        ) : null}

        <section className="space-y-5">
          {data.orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </section>
      </main>
    </div>
  );
}

function OrderHeader() {
  return (
    <header className="sticky top-0 z-header bg-white/70 shadow-[0_40px_40px_-15px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-16 w-full max-w-mobile items-center justify-between px-7">
        <div className="flex items-center gap-4">
          <Link href="/store" aria-label="Back to store" className="text-primary">
            <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.4} />
          </Link>
          <p className="text-lg font-bold tracking-wide text-primary">Orders</p>
        </div>
        <Truck aria-hidden="true" className="size-6 text-primary" />
      </div>
    </header>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[18px] bg-primary/5 px-3 py-4 text-center">
      <p className="text-xl font-extrabold text-primary">{value}</p>
      <p className="mt-1 text-[10px] font-bold leading-4 text-[#3e494a]">{label}</p>
    </div>
  );
}

function OrderCard({ order }: { order: CustomerOrderItem }) {
  return (
    <article className="rounded-[24px] border border-white/40 bg-white/70 p-5 shadow-[0_10px_30px_rgba(0,96,103,0.05)] backdrop-blur-[24px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6e797a]">{order.orderCode}</p>
          <h2 className="mt-2 truncate text-base font-extrabold text-[#191c1e]">{order.itemSummary}</h2>
          <p className="mt-1 text-xs font-medium text-[#3e494a]">
            {order.itemCount} รายการ / อัปเดต {order.updatedAt}
          </p>
        </div>
        <StatusBadge tone={order.statusTone}>{order.statusLabel}</StatusBadge>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <InfoTile icon="receipt" label="ยอดรวม" value={order.total} />
        <InfoTile icon="payment" label="ชำระเงิน" value={order.paymentLabel} />
        <InfoTile icon="shipment" label="จัดส่ง" value={order.shipmentLabel} />
        <InfoTile icon="tracking" label="เลขพัสดุ" value={order.trackingNumber ?? "-"} />
      </dl>

      <div className="mt-6 space-y-6 border-t border-[#bdc9ca]/20 pt-6">
        {order.steps.map((step, index) => (
          <TrackingStepRow key={step.title} step={step} isLast={index === order.steps.length - 1} />
        ))}
      </div>

      {order.paymentVerificationRequired ? <PaymentInstructionPanel order={order} /> : null}

      {order.paymentVerificationRequired && order.paymentId ? (
        <CustomerSlipVerification paymentId={order.paymentId} orderCode={order.orderCode} />
      ) : null}
    </article>
  );
}

function PaymentInstructionPanel({ order }: { order: CustomerOrderItem }) {
  return (
    <section className="mt-6 rounded-[20px] border border-[#bdc9ca]/20 bg-white/75 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6e797a]">PromptPay</p>
          <h3 className="mt-1 text-sm font-extrabold text-primary">Scan to pay {order.total}</h3>
        </div>
        <ReceiptText aria-hidden="true" className="size-5 shrink-0 text-primary" />
      </div>

      {order.paymentQrDataUrl ? (
        <div className="mx-auto mt-4 flex w-full max-w-[220px] items-center justify-center rounded-[18px] bg-white p-3 shadow-qr-inset">
          <Image
            src={order.paymentQrDataUrl}
            alt={`PromptPay QR code for ${order.orderCode}`}
            width={196}
            height={196}
            className="h-auto w-full"
            unoptimized
          />
        </div>
      ) : (
        <p className="mt-4 rounded-[14px] bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-[#3e494a]">
          Dynamic QR is not configured yet. Add THAI_QR_PROMPTPAY_ID before accepting production payments.
        </p>
      )}

      {order.paymentQrPayload ? (
        <p className="mt-3 break-all rounded-[14px] bg-slate-50 px-3 py-2 text-[10px] leading-4 text-slate-500">
          {order.paymentQrPayload}
        </p>
      ) : null}
    </section>
  );
}

function InfoTile({ icon, label, value }: { icon: "receipt" | "payment" | "shipment" | "tracking"; label: string; value: string }) {
  const Icon = icon === "receipt" || icon === "payment" ? ReceiptText : icon === "shipment" ? PackageCheck : Truck;

  return (
    <div className="rounded-[18px] bg-white/70 p-4">
      <dt className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6e797a]">
        <Icon aria-hidden="true" className="size-3.5 text-primary" />
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm font-bold leading-5 text-[#191c1e]">{value}</dd>
    </div>
  );
}

function TrackingStepRow({ step, isLast }: { step: CustomerOrderTrackingStep; isLast: boolean }) {
  const isDone = step.status === "done";
  const isActive = step.status === "active";

  return (
    <div className="relative flex gap-4">
      {!isLast ? (
        <span
          aria-hidden="true"
          className={`absolute left-[11px] top-8 h-[calc(100%+0.75rem)] w-0.5 ${isDone ? "bg-primary" : "bg-[#e0e3e5]"}`}
        />
      ) : null}

      <span
        className={
          isDone
            ? "z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm"
            : isActive
              ? "z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-4 border-primary bg-white"
              : "z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e6e8ea]"
        }
      >
        {isDone ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : null}
        {isActive ? <span className="size-1.5 animate-pulse rounded-full bg-primary" /> : null}
        {step.status === "pending" ? <span className="size-1.5 rounded-full bg-[#bdc9ca]" /> : null}
      </span>

      <div>
        <h3
          className={
            isActive
              ? "text-sm font-bold leading-5 text-primary"
              : isDone
                ? "text-sm font-bold leading-5 text-[#191c1e]"
                : "text-sm font-medium leading-5 text-[#6e797a]"
          }
        >
          {step.title}
        </h3>
        {step.description ? <p className="mt-1 text-xs leading-5 text-[#3e494a]">{step.description}</p> : null}
      </div>
    </div>
  );
}

function EmptyOrders({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-[24px] border border-white/40 bg-white/70 p-6 text-center shadow-[0_10px_30px_rgba(0,96,103,0.05)] backdrop-blur-[24px]">
      <h2 className="text-base font-bold text-primary">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#3e494a]">{body}</p>
      <Link href="/store" className="mt-5 inline-flex text-sm font-bold text-primary underline-offset-4 hover:underline">
        ไปที่ร้านค้า
      </Link>
    </section>
  );
}
