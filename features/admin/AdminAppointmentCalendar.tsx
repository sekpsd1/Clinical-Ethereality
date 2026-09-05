import { CalendarDays, Clock3, Stethoscope, UserRound } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AdminAppointmentCalendarData } from "@/features/admin/schedules/types";

const statusTones = {
  available: "success",
  pending_payment: "warning",
  scheduled: "neutral",
  live: "danger"
} as const;

export function AdminAppointmentCalendar({ data }: { data: AdminAppointmentCalendarData }) {
  return (
    <section id="doctor-schedule" className="scroll-mt-4 rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label font-bold uppercase text-primary">ขั้นตอนที่ 2</p>
          <h2 className="mt-1 font-headline text-lg font-bold text-text">ตารางแพทย์ วันที่ {data.dateLabel}</h2>
          <p className="mt-1 text-xs leading-5 text-muted">เลือกแพทย์เพื่อจัดการเวลาตรวจของวันนั้น รายการจองและช่วงที่รอชำระเงินจะแสดงแยกชัดเจน</p>
        </div>
        <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-primary" />
      </div>

      <form action="/admin/schedules#doctor-schedule" method="get" className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input type="hidden" name="date" value={data.dateValue} />
        <label className="text-xs font-bold text-text">
          เลือกแพทย์
          <select name="doctor" defaultValue={data.selectedDoctorId} className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text">
            <option value="">แสดงแพทย์ทุกคน</option>
            {data.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
          </select>
        </label>
        <button type="submit" className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-primary px-4 text-sm font-bold text-white"><Stethoscope aria-hidden="true" className="size-4" />จัดการแพทย์</button>
      </form>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
        <p className="text-sm font-bold text-text">{data.selectedDoctorId ? "ตารางของแพทย์ที่เลือก" : "ตารางแพทย์ทั้งหมด"}</p>
        <StatusBadge tone={data.slots.length > 0 ? "success" : "neutral"}>{data.slots.length} ช่วงเวลา</StatusBadge>
      </div>

      {data.slots.length === 0 ? <p className="mt-4 rounded-[8px] border border-dashed border-border bg-white/65 p-4 text-center text-xs font-semibold leading-5 text-muted">ไม่มีช่วงเวลารับนัดของแพทย์ที่เลือกในวันนี้</p> : <div className="mt-3 divide-y divide-border/70 rounded-[8px] border border-border bg-white">{data.slots.map((slot) => <article key={slot.id} className="flex items-start gap-3 p-3"><div className="flex min-w-14 items-center gap-1 text-sm font-bold text-text"><Clock3 aria-hidden="true" className="size-3.5 text-primary" />{slot.timeLabel}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-text">{slot.doctorName}</p><StatusBadge tone={statusTones[slot.status]}>{slot.statusLabel}</StatusBadge></div>{slot.patientName ? <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-muted"><UserRound aria-hidden="true" className="size-3.5" />{slot.patientName}</p> : <p className="mt-1 text-xs font-semibold text-success">พร้อมแจ้งลูกค้าเพื่อนัดหมาย</p>}{slot.lockExpiresAt ? <p className="mt-1 text-[11px] font-semibold text-warning">ล็อกถึง {slot.lockExpiresAt}</p> : null}</div></article>)}</div>}
    </section>
  );
}
