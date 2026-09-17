import Link from "next/link";
import type { Route } from "next";
import { CalendarDays, ChevronRight, Clock3, Stethoscope } from "lucide-react";
import type { CustomerUpcomingAppointmentData } from "@/features/profile/types";

export function ProfileUpcomingAppointment({ data }: { data: CustomerUpcomingAppointmentData }) {
  const appointment = data.appointment;
  if (!appointment) return null;

  return (
    <section aria-labelledby="upcoming-appointment-heading" className={appointment.isImminent ? "rounded-[24px] border border-primary/25 bg-[#e8fbf7] p-5 shadow-[0_12px_32px_rgba(0,96,103,0.12)]" : "rounded-[24px] border border-white/50 bg-white/75 p-5 shadow-[0_10px_30px_rgba(0,96,103,0.06)] backdrop-blur-[24px]"}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm">
            <CalendarDays aria-hidden="true" className="size-5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <h2 id="upcoming-appointment-heading" className="text-base font-extrabold text-primary">นัดปรึกษาที่กำลังจะมาถึง</h2>
            <p className="mt-0.5 text-xs leading-5 text-[#3e494a]">รายละเอียดนัดที่ยืนยันแล้ว</p>
          </div>
        </div>
        <span className={appointment.isImminent ? "shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-extrabold text-white" : "shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-extrabold text-primary"}>
          {appointment.relativeDayLabel}
        </span>
      </div>

      <div className="mt-4 rounded-[18px] bg-white/65 p-4">
        <div className="flex gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Stethoscope aria-hidden="true" className="size-4.5" strokeWidth={2.25} /></span>
          <div className="min-w-0">
            <p className="break-words text-sm font-extrabold leading-5 text-[#191c1e]">{appointment.doctorName}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-5 text-[#3e494a]"><Clock3 aria-hidden="true" className="size-3.5 shrink-0 text-primary" />{appointment.scheduledDateTime}</p>
            {appointment.isImminent ? <p className="mt-2 text-xs font-bold leading-5 text-primary">นัดของคุณใกล้ถึงเวลาแล้ว</p> : null}
            {appointment.additionalCount > 0 ? <p className="mt-2 text-xs font-medium leading-5 text-[#3e494a]">และอีก {appointment.additionalCount} นัด</p> : null}
          </div>
        </div>
      </div>

      <Link href={`/consult/appointments/${appointment.id}` as Route} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-extrabold text-white shadow-sm active:scale-[0.99]">
        ดูรายละเอียดนัด
        <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2.5} />
      </Link>
    </section>
  );
}
