import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, CalendarDays, Clock3, CreditCard, ShieldCheck, Stethoscope } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { CustomerAppointmentData } from "@/features/consultations/appointment/types";

export function AppointmentDetail({ data }: { data: CustomerAppointmentData }) {
  const appointment = data.appointment;

  return (
    <section className="-mx-4 min-h-dvh bg-app pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <AppointmentTopBar />

      <div className="flex flex-col gap-5 px-6 pt-24">
        {data.unavailable ? (
          <StateCard
            title="ยังโหลดรายละเอียดนัดหมายไม่ได้"
            body="กรุณาลองใหม่จากแท็บปรึกษาแพทย์"
            href="/consult"
            cta="กลับไปหน้าปรึกษา"
          />
        ) : appointment ? (
          <>
            <article className="rounded-[24px] border border-[#bdc9ca]/15 bg-white/75 p-5 shadow-bio-card backdrop-blur-topbar">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-full border-2 border-white shadow-avatar">
                    <Image
                      src={appointment.doctorAvatarUrl}
                      alt={appointment.doctorName}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase leading-4 tracking-[1px] text-[#3e494a]">
                      นัดหมายปรึกษาแพทย์
                    </p>
                    <h1 className="truncate text-xl font-extrabold leading-7 text-primary">{appointment.doctorName}</h1>
                    <p className="truncate text-sm font-medium leading-5 text-[#3e494a]">{appointment.doctorSpecialty}</p>
                  </div>
                </div>
                <StatusBadge tone={appointment.statusTone}>{appointment.statusLabel}</StatusBadge>
              </div>
            </article>

            <section className="grid gap-3">
              <AppointmentInfoRow icon={CalendarDays} label="วันที่นัดหมาย" value={appointment.scheduledDate} />
              <AppointmentInfoRow icon={Clock3} label="เวลาปรึกษา" value={appointment.scheduledTime} />
              <AppointmentInfoRow icon={CreditCard} label="ค่าปรึกษา" value={appointment.feeLabel} />
            </section>

            <article className="rounded-[24px] border border-[#bdc9ca]/15 bg-white/75 p-5 shadow-payment-card backdrop-blur-topbar">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck aria-hidden="true" className="size-5" strokeWidth={2.25} />
                </span>
                <div>
                  <h2 className="text-base font-extrabold leading-6 text-primary">{appointment.nextStepLabel}</h2>
                  <p className="mt-1 text-sm leading-6 text-[#3e494a]">{appointment.nextStepDescription}</p>
                </div>
              </div>
            </article>

            <Link
              href={appointment.ctaHref as Route}
              className="flex h-16 w-full items-center justify-center gap-3 rounded-full bg-primary-gradient px-5 text-base font-bold leading-6 text-white shadow-booking"
            >
              <Stethoscope aria-hidden="true" className="size-5" strokeWidth={2.2} />
              {appointment.ctaLabel}
            </Link>
          </>
        ) : (
          <StateCard
            title="ไม่พบนัดหมาย"
            body="นัดหมายนี้อาจถูกย้าย ยกเลิก หรือเป็นของบัญชีอื่น"
            href="/consult"
            cta="กลับไปหน้าปรึกษา"
          />
        )}
      </div>
    </section>
  );
}

function AppointmentTopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-header mx-auto flex h-16 max-w-[480px] items-center bg-white/70 px-6 shadow-booking-top backdrop-blur-topbar">
      <Link href="/consult" aria-label="กลับไปหน้าปรึกษา" className="flex size-10 items-center justify-start text-primary">
        <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.25} />
      </Link>
      <h1 className="pl-2 text-lg font-bold leading-7 tracking-normal text-primary">รายละเอียดนัดหมาย</h1>
    </header>
  );
}

function AppointmentInfoRow({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-[20px] border border-[#bdc9ca]/15 bg-white/70 px-4 py-4 shadow-payment-card backdrop-blur-topbar">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e0f7f6] text-primary">
        <Icon aria-hidden="true" className="size-5" strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase leading-4 tracking-[1px] text-[#3e494a]">{label}</p>
        <p className="truncate text-base font-bold leading-6 text-[#191c1e]">{value}</p>
      </div>
    </div>
  );
}

function StateCard({ title, body, href, cta }: { title: string; body: string; href: Route; cta: string }) {
  return (
    <article className="rounded-[24px] border border-[#bdc9ca]/15 bg-white/75 p-6 text-center shadow-bio-card backdrop-blur-topbar">
      <h1 className="text-xl font-extrabold leading-7 text-primary">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-[#3e494a]">{body}</p>
      <Link
        href={href}
        className="mt-6 flex h-14 w-full items-center justify-center rounded-full bg-primary-gradient px-5 text-sm font-bold leading-5 text-white shadow-booking"
      >
        {cta}
      </Link>
    </article>
  );
}
