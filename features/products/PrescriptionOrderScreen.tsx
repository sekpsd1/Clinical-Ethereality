import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, ClipboardCheck, PackageCheck, Pill, ShieldCheck, ShoppingCart } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createPrescriptionOrderAction } from "@/features/products/prescriptions/actions";
import type { PrescriptionOrderData, PrescriptionOrderProduct } from "@/features/products/prescriptions/types";

export function PrescriptionOrderScreen({ data, orderStatus }: { data: PrescriptionOrderData; orderStatus?: string }) {
  const prescription = data.prescription;

  return (
    <section className="-mx-4 min-h-dvh bg-advice-radial pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <header className="fixed inset-x-0 top-0 z-header mx-auto flex h-16 max-w-[480px] items-center bg-white/70 px-6 shadow-booking-top backdrop-blur-payment">
        <Link href="/consult/prescriptions" aria-label="กลับไปสถานะใบสั่งยา" className="flex size-10 items-center justify-start text-primary">
          <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.25} />
        </Link>
        <h1 className="pl-2 text-lg font-bold leading-7 tracking-normal text-primary">สั่งยาตามใบสั่งแพทย์</h1>
      </header>

      <main className="space-y-5 px-6 pt-24">
        {data.unavailable ? (
          <StateCard title="ไม่สามารถโหลดข้อมูลได้" body="กรุณาตรวจสอบฐานข้อมูล แล้วลองเปิดจากหน้าสถานะใบสั่งยาอีกครั้ง" />
        ) : prescription ? (
          <>
            <section className="rounded-[24px] border border-white/40 bg-white/75 p-5 shadow-payment-card backdrop-blur-payment">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase leading-4 tracking-[1px] text-[#3e494a]">ใบสั่งยา</p>
                  <h2 className="mt-2 text-2xl font-extrabold leading-8 text-primary">เลือกยาที่ต้องการสั่งซื้อ</h2>
                </div>
                <StatusBadge tone={prescription.linkedOrderCode ? "success" : "warning"}>{prescription.statusLabel}</StatusBadge>
              </div>

              <div className="mt-5 grid gap-3">
                <InfoRow icon={ClipboardCheck} label="แพทย์" value={prescription.doctorName} />
                <InfoRow icon={ShieldCheck} label="เภสัชกร" value={prescription.pharmacistName ?? "ตรวจผ่านแล้ว"} />
                <InfoRow icon={PackageCheck} label="คำสั่งซื้อ" value={prescription.linkedOrderCode ?? "ยังไม่ได้สร้างคำสั่งซื้อ"} />
              </div>

              <div className="mt-4 rounded-[18px] bg-[#f7f9fb]/85 p-4">
                <p className="text-[11px] font-bold uppercase leading-4 tracking-[1px] text-[#3e494a]">บันทึกจากแพทย์</p>
                <p className="mt-2 text-sm leading-6 text-[#3e494a]">{prescription.notes}</p>
              </div>
            </section>

            {orderStatus === "failed" ? (
              <div className="rounded-[18px] border border-[#ba1a1a]/20 bg-white/80 p-4 text-sm font-bold leading-6 text-[#93000a] shadow-payment-card">
                ไม่สามารถสร้างคำสั่งซื้อได้ อาจมีคำสั่งซื้อที่เชื่อมกับใบสั่งยานี้แล้ว หรือสินค้าไม่พร้อมจัดส่ง
              </div>
            ) : null}

            {prescription.linkedOrderCode ? (
              <StateCard
                title="มีคำสั่งซื้อที่เชื่อมกับใบสั่งยานี้แล้ว"
                body={`เลขคำสั่งซื้อ ${prescription.linkedOrderCode} สามารถติดตามสถานะได้ในหน้าคำสั่งซื้อ`}
                href="/store/orders"
                cta="ติดตามคำสั่งซื้อ"
              />
            ) : prescription.products.length > 0 ? (
              <section className="space-y-4">
                {prescription.products.map((product) => (
                  <PrescriptionProductCard key={product.id} prescriptionId={prescription.id} product={product} />
                ))}
              </section>
            ) : (
              <StateCard title="ยังไม่มีสินค้าที่ต้องใช้ใบสั่งยา" body="เมื่อแอดมินเพิ่มสินค้าในหมวดที่ต้องใช้ใบสั่งยา รายการจะปรากฏที่นี่" />
            )}
          </>
        ) : (
          <StateCard title="ไม่พบใบสั่งยา" body="ใบสั่งยานี้อาจถูกย้าย ถูกยกเลิก หรือไม่ใช่ของบัญชีที่กำลังเข้าสู่ระบบ" />
        )}
      </main>
    </section>
  );
}

function PrescriptionProductCard({
  prescriptionId,
  product
}: {
  prescriptionId: string;
  product: PrescriptionOrderProduct;
}) {
  return (
    <article className="rounded-[24px] border border-[#bdc9ca]/15 bg-white/75 p-5 shadow-payment-card backdrop-blur-payment">
      <div className="flex items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Pill aria-hidden="true" className="size-7" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-extrabold leading-6 text-[#191c1e]">{product.name}</h3>
          <p className="mt-1 text-sm leading-6 text-[#3e494a]">{product.description}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-lg font-extrabold leading-7 text-primary">{product.priceLabel}</p>
            <p className="text-[11px] font-bold uppercase leading-4 text-[#3e494a]">{product.stockLabel}</p>
          </div>
        </div>
      </div>

      <form action={createPrescriptionOrderAction} className="mt-5">
        <input type="hidden" name="prescriptionId" value={prescriptionId} />
        <input type="hidden" name="productId" value={product.id} />
        <button
          type="submit"
          disabled={product.availableQuantity <= 0}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-gradient px-5 text-sm font-bold leading-5 text-white shadow-booking disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShoppingCart aria-hidden="true" className="size-5" strokeWidth={2.2} />
          สร้างคำสั่งซื้อ
        </button>
      </form>
    </article>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value
}: {
  icon: typeof ClipboardCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[16px] bg-white/70 px-3 py-3">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" strokeWidth={2.2} />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase leading-4 text-[#3e494a]">{label}</p>
        <p className="truncate text-xs font-bold leading-5 text-[#191c1e]">{value}</p>
      </div>
    </div>
  );
}

function StateCard({ title, body, href, cta }: { title: string; body: string; href?: string; cta?: string }) {
  return (
    <section className="rounded-[24px] border border-[#bdc9ca]/15 bg-white/75 p-6 text-center shadow-payment-card backdrop-blur-payment">
      <h2 className="text-base font-extrabold leading-6 text-primary">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#3e494a]">{body}</p>
      {href && cta ? (
        <Link
          href={href as Route}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-primary-gradient px-5 text-sm font-bold leading-5 text-white shadow-booking"
        >
          {cta}
        </Link>
      ) : null}
    </section>
  );
}
