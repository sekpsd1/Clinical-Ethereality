import Link from "next/link";
import { ArrowLeft, PackageCheck, ReceiptText, ShieldCheck, Truck } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrderTrackingTimeline } from "@/components/ui/OrderTrackingTimeline";
import { PaymentStatusBadge } from "@/components/ui/PaymentStatusBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { CustomerOrderItem } from "@/features/orders/types";

type CustomerOrderDetailProps = {
  order: CustomerOrderItem | null;
  unavailable?: boolean;
};

export function CustomerOrderDetail({ order, unavailable }: CustomerOrderDetailProps) {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[linear-gradient(180deg,#f7f9fb_0%,#eef3f4_100%)] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <Header />

      <main className="mx-auto w-full max-w-mobile px-6 py-7">
        {unavailable ? (
          <EmptyState
            title="ไม่สามารถโหลดคำสั่งซื้อได้"
            body="กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูลหรือกลับมาลองใหม่อีกครั้ง"
            icon={<ReceiptText aria-hidden="true" className="size-5" />}
            action={<BackToOrdersLink />}
            className="mt-8 bg-white/75"
          />
        ) : null}

        {!unavailable && !order ? (
          <EmptyState
            title="ไม่พบคำสั่งซื้อนี้"
            body="คำสั่งซื้ออาจไม่อยู่ในบัญชีนี้ หรือยังไม่มีข้อมูลสำหรับแสดงรายละเอียด"
            icon={<PackageCheck aria-hidden="true" className="size-5" />}
            action={<BackToOrdersLink />}
            className="mt-8 bg-white/75"
          />
        ) : null}

        {order ? <OrderDetailContent order={order} /> : null}
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-header bg-white/70 shadow-[0_40px_40px_-15px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-16 w-full max-w-mobile items-center justify-between px-7">
        <div className="flex items-center gap-4">
          <Link href="/store/orders" aria-label="กลับไปหน้าคำสั่งซื้อ" className="text-primary">
            <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.4} />
          </Link>
          <p className="text-lg font-bold tracking-wide text-primary">รายละเอียดคำสั่งซื้อ</p>
        </div>
        <Truck aria-hidden="true" className="size-6 text-primary" />
      </div>
    </header>
  );
}

function OrderDetailContent({ order }: { order: CustomerOrderItem }) {
  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-white/40 bg-white/75 p-6 shadow-[0_12px_40px_rgba(0,96,103,0.08)] backdrop-blur-[24px]">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6e797a]">{order.orderCode}</p>
        <h1 className="mt-3 text-[24px] font-extrabold leading-7 text-primary">{order.itemSummary}</h1>
        <p className="mt-2 text-sm leading-6 text-[#3e494a]">
          {order.itemCount} รายการ / อัปเดตล่าสุด {order.updatedAt}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <StatusBadge tone={order.statusTone}>{order.statusLabel}</StatusBadge>
          <PaymentStatusBadge status={order.paymentStatus} label={order.paymentLabel} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <DetailTile label="ยอดรวม" value={order.total} />
        <DetailTile label="การชำระเงิน" value={order.paymentLabel} />
        <DetailTile label="การจัดส่ง" value={order.shipmentLabel} />
        <DetailTile label="เลขพัสดุ" value={order.trackingNumber ?? "-"} />
      </section>

      <section className="rounded-[24px] border border-white/40 bg-white/75 p-6 shadow-[0_10px_30px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e8fbf7] text-primary">
            <ShieldCheck aria-hidden="true" className="size-5" strokeWidth={2.25} />
          </span>
          <div>
            <h2 className="text-base font-extrabold text-[#191c1e]">สถานะการดำเนินการ</h2>
            <p className="mt-1 text-xs leading-5 text-[#6e797a]">เก็บประวัติคำสั่งซื้อ การชำระเงิน และการจัดส่งให้ตรวจสอบย้อนหลังได้</p>
          </div>
        </div>
        <OrderTrackingTimeline steps={order.steps} />
      </section>

      {order.paymentVerificationRequired ? (
        <section className="rounded-[24px] border border-primary/10 bg-primary/5 p-5">
          <h2 className="text-base font-extrabold text-primary">รอตรวจสอบการชำระเงิน</h2>
          <p className="mt-2 text-sm leading-6 text-[#3e494a]">
            ระบบยังคงใช้หน้ารายการคำสั่งซื้อสำหรับอัปโหลดและตรวจสอบสลิป เพื่อให้ขั้นตอนการชำระเงินอยู่ในจุดเดียว
          </p>
          <BackToOrdersLink className="mt-4 inline-flex" />
        </section>
      ) : null}
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/40 bg-white/75 p-4 shadow-sm backdrop-blur-[24px]">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6e797a]">{label}</p>
      <p className="mt-2 break-words text-sm font-extrabold leading-5 text-[#191c1e]">{value}</p>
    </div>
  );
}

function BackToOrdersLink({ className }: { className?: string }) {
  return (
    <Link href="/store/orders" className={className ?? "inline-flex text-sm font-bold text-primary underline-offset-4 hover:underline"}>
      กลับไปหน้าคำสั่งซื้อ
    </Link>
  );
}
