import Link from "next/link";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ClipboardCheck, FileClock, PackageCheck, Pill, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type {
  CustomerPrescriptionItem,
  CustomerPrescriptionsData
} from "@/features/consultations/prescriptions/types";

export function PrescriptionStatusScreen({ data }: { data: CustomerPrescriptionsData }) {
  return (
    <section className="-mx-4 min-h-dvh bg-advice-radial pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <PrescriptionTopBar />

      <main className="space-y-5 px-6 pt-24">
        <section className="rounded-[24px] border border-white/40 bg-white/75 p-5 shadow-payment-card backdrop-blur-payment">
          <p className="text-[11px] font-bold uppercase leading-4 tracking-[1px] text-[#3e494a]">สถานะใบสั่งยา</p>
          <h1 className="mt-2 text-2xl font-extrabold leading-8 text-primary">ความพร้อมของยา</h1>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <SummaryTile label="รอตรวจ" value={data.summary.pending} />
            <SummaryTile label="พร้อมจ่าย" value={data.summary.verified} />
            <SummaryTile label="ต้องแก้ไข" value={data.summary.rejected} />
          </div>
        </section>

        {data.unavailable ? (
          <EmptyState title="ไม่สามารถโหลดสถานะใบสั่งยาได้" body="กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล แล้วลองเปิดจากหน้าการปรึกษาอีกครั้ง" />
        ) : null}

        {!data.unavailable && data.prescriptions.length === 0 ? (
          <EmptyState title="ยังไม่มีใบสั่งยา" body="ใบสั่งยาจากการปรึกษาแพทย์จะแสดงที่นี่เมื่อมีการบันทึกเข้าระบบ" />
        ) : null}

        <section className="space-y-4">
          {data.prescriptions.map((prescription) => (
            <PrescriptionCard key={prescription.id} prescription={prescription} />
          ))}
        </section>
      </main>
    </section>
  );
}

function PrescriptionTopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-header mx-auto flex h-16 max-w-[480px] items-center bg-white/70 px-6 shadow-booking-top backdrop-blur-payment">
      <Link href="/consult/advice-log" aria-label="กลับไปหน้าสรุปคำแนะนำ" className="flex size-10 items-center justify-start text-primary">
        <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.25} />
      </Link>
      <h1 className="pl-2 text-lg font-bold leading-7 tracking-normal text-primary">สถานะใบสั่งยา</h1>
    </header>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[16px] bg-white/70 px-3 py-3 text-center shadow-chip">
      <p className="text-xl font-extrabold leading-6 text-primary">{value}</p>
      <p className="mt-1 truncate text-[10px] font-bold uppercase leading-4 text-[#3e494a]">{label}</p>
    </div>
  );
}

function PrescriptionCard({ prescription }: { prescription: CustomerPrescriptionItem }) {
  return (
    <article className="rounded-[24px] border border-[#bdc9ca]/15 bg-white/75 p-5 shadow-payment-card backdrop-blur-payment">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Pill aria-hidden="true" className="size-6" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-extrabold leading-6 text-[#191c1e]">{prescription.productSummary}</h2>
            <p className="mt-1 text-xs font-semibold leading-5 text-[#3e494a]">แพทย์: {prescription.doctorName}</p>
          </div>
        </div>
        <StatusBadge tone={prescription.statusTone}>{prescription.statusLabel}</StatusBadge>
      </div>

      <div className="mt-4 grid gap-3">
        <InfoRow icon={FileClock} label="การปรึกษา" value={prescription.consultationDate} />
        <InfoRow icon={ShieldCheck} label="เภสัชกร" value={prescription.pharmacistName ?? "ยังไม่ได้มอบหมาย"} />
        <InfoRow icon={PackageCheck} label="คำสั่งซื้อที่เกี่ยวข้อง" value={prescription.linkedOrderCode ?? "ยังไม่มีคำสั่งซื้อ"} />
      </div>

      <div className="mt-4 rounded-[18px] bg-[#f7f9fb]/85 p-4">
        <p className="text-[11px] font-bold uppercase leading-4 tracking-[1px] text-[#3e494a]">บันทึกจากแพทย์</p>
        <p className="mt-2 text-sm leading-6 text-[#3e494a]">{prescription.notes}</p>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-[18px] bg-primary/5 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-primary">
          <ClipboardCheck aria-hidden="true" className="size-5" strokeWidth={2.25} />
        </span>
        <div>
          <h3 className="text-sm font-extrabold leading-5 text-primary">{prescription.nextStepTitle}</h3>
          <p className="mt-1 text-xs leading-5 text-[#3e494a]">{prescription.nextStepBody}</p>
        </div>
      </div>

      <Link
        href={prescription.ctaHref as Route}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-primary-gradient px-5 text-sm font-bold leading-5 text-white shadow-booking"
      >
        {prescription.ctaLabel}
      </Link>
    </article>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
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

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-[24px] border border-[#bdc9ca]/15 bg-white/75 p-6 text-center shadow-payment-card backdrop-blur-payment">
      <h2 className="text-base font-extrabold leading-6 text-primary">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#3e494a]">{body}</p>
      <Link
        href="/consult"
        className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-primary-gradient px-5 text-sm font-bold leading-5 text-white shadow-booking"
      >
        กลับไปหน้าปรึกษา
      </Link>
    </section>
  );
}
