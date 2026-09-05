"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, Plus, Stethoscope } from "lucide-react";
import { AdminCalendarSlotDrawer } from "@/features/admin/AdminCalendarSlotDrawer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AdminAppointmentCalendarData, AdminAppointmentCalendarSlot, AdminDoctorAvailabilityDateOverride, AdminDoctorOption, AdminManualAppointmentPatient } from "@/features/admin/schedules/types";

const statusPresentation = {
  available: { label: "ว่าง", tone: "success", className: "border-success/25 bg-success/10 text-success" },
  pending_payment: { label: "ไม่ว่าง", tone: "danger", className: "border-danger/25 bg-danger/10 text-danger" },
  scheduled: { label: "ไม่ว่าง", tone: "danger", className: "border-danger/25 bg-danger/10 text-danger" },
  live: { label: "ไม่ว่าง", tone: "danger", className: "border-danger/25 bg-danger/10 text-danger" },
  closed: { label: "-", tone: "neutral", className: "border-border bg-surface text-muted" }
} as const;

function moveDate(value: string, view: AdminAppointmentCalendarData["view"], direction: -1 | 1) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + direction * (view === "day" ? 1 : view === "week" ? 7 : 1));
  return date.toISOString().slice(0, 10);
}

export function AdminAppointmentCalendar({ data, manualAppointmentPatients, workingHoursDoctors, dateOverrides }: { data: AdminAppointmentCalendarData; manualAppointmentPatients: AdminManualAppointmentPatient[]; workingHoursDoctors: AdminDoctorOption[]; dateOverrides: AdminDoctorAvailabilityDateOverride[] }) {
  const [selectedSlot, setSelectedSlot] = useState<{ dateValue: string; slot: AdminAppointmentCalendarSlot } | null>(null);
  const calendarHref = (date: string, view = data.view) => ({ pathname: "/admin/schedules", query: { doctor: data.selectedDoctorId, date, view }, hash: "doctor-schedule" });
  const timeRows = useMemo(() => Array.from(new Set(data.days.flatMap((day) => day.slots.map((slot) => slot.timeLabel)))).sort(), [data.days]);
  const gridDays = data.view === "day" ? data.days.slice(0, 1) : data.days;
  const gridTemplateColumns = `72px repeat(${Math.max(gridDays.length, 1)}, minmax(128px, 1fr))`;

  return <section id="doctor-schedule" className="scroll-mt-4 rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
    <div className="flex items-start justify-between gap-3"><div><h2 className="font-headline text-lg font-bold text-text">ปฏิทินนัดหมายแพทย์</h2><p className="mt-1 text-xs leading-5 text-muted">เลือกแพทย์ก่อนดูช่วงเวลานัดหมาย โดยปฏิทินไม่แสดงข้อมูลผู้ป่วย</p></div><CalendarDays aria-hidden="true" className="size-5 shrink-0 text-primary" /></div>
    <form action="/admin/schedules#doctor-schedule" method="get" className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><input type="hidden" name="date" value={data.dateValue} /><input type="hidden" name="view" value={data.view} /><label className="text-xs font-bold text-text">เลือกแพทย์<select required name="doctor" defaultValue={data.selectedDoctorId} className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text"><option value="">เลือกแพทย์เพื่อดูปฏิทิน</option>{data.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label><button type="submit" className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-primary px-4 text-sm font-bold text-white"><Stethoscope aria-hidden="true" className="size-4" />แสดงปฏิทิน</button></form>
    {!data.selectedDoctorId ? <p className="mt-4 rounded-[8px] border border-dashed border-border bg-white/65 p-4 text-center text-xs font-semibold leading-5 text-muted">กรุณาเลือกแพทย์ก่อนดูสถานะเวลานัดหมาย</p> : <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3"><div className="flex gap-1">{(["day", "week", "month"] as const).map((view) => <Link key={view} href={calendarHref(data.dateValue, view)} className={`rounded-[8px] px-3 py-2 text-xs font-bold ${data.view === view ? "bg-primary text-white" : "bg-surface text-primary"}`}>{view === "day" ? "วัน" : view === "week" ? "สัปดาห์" : "เดือน"}</Link>)}</div><div className="flex items-center gap-2 text-xs font-bold text-text"><Link href={calendarHref(moveDate(data.dateValue, data.view, -1))} className="rounded-[8px] border border-border px-2 py-1">ก่อนหน้า</Link><span>{data.dateLabel}</span><Link href={calendarHref(moveDate(data.dateValue, data.view, 1))} className="rounded-[8px] border border-border px-2 py-1">ถัดไป</Link></div></div>
      {data.view === "month" ? <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{data.days.map((day) => <Link key={day.dateValue} href={calendarHref(day.dateValue, "day")} className="rounded-[8px] border border-border bg-white p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold text-text">{day.dateLabel}</p><StatusBadge tone={day.slots.length ? "success" : "neutral"}>{day.slots.length} ช่วง</StatusBadge></div><p className="mt-2 text-xs text-muted">{day.slots.length ? "มีเวลารับนัด" : "-"}</p></Link>)}</div> : <ScheduleGrid days={gridDays} timeRows={timeRows} gridTemplateColumns={gridTemplateColumns} onSelect={(dateValue, slot) => setSelectedSlot({ dateValue, slot })} />}
    </>}
    {selectedSlot ? <AdminCalendarSlotDrawer dateValue={selectedSlot.dateValue} patients={manualAppointmentPatients} slot={selectedSlot.slot} doctors={workingHoursDoctors} overrides={dateOverrides} onClose={() => setSelectedSlot(null)} /> : null}
  </section>;
}

function ScheduleGrid({ days, timeRows, gridTemplateColumns, onSelect }: { days: AdminAppointmentCalendarData["days"]; timeRows: string[]; gridTemplateColumns: string; onSelect: (dateValue: string, slot: AdminAppointmentCalendarSlot) => void }) {
  if (timeRows.length === 0) return <p className="mt-3 rounded-[8px] border border-dashed border-border bg-surface/60 p-4 text-center text-xs font-semibold text-muted">ไม่มีช่วงเวลารับนัดสำหรับแพทย์และช่วงวันที่เลือก</p>;
  const referenceSlot = days.flatMap((day) => day.slots)[0];
  return <div className="mt-3 overflow-x-auto rounded-[8px] border border-border"><div style={{ minWidth: days.length > 1 ? "960px" : "320px" }}><div className="grid border-b border-border bg-surface/70" style={{ gridTemplateColumns }}><div className="px-3 py-2 text-[11px] font-bold text-muted">เวลา</div>{days.map((day) => <div key={day.dateValue} className="border-l border-border px-3 py-2 text-xs font-bold text-text">{day.dateLabel}</div>)}</div>{timeRows.map((timeLabel) => <div key={timeLabel} className="grid border-b border-border last:border-b-0" style={{ gridTemplateColumns }}><div className="px-3 py-3 text-xs font-bold text-text">{timeLabel}</div>{days.map((day) => { const slot = day.slots.find((item) => item.timeLabel === timeLabel) ?? createClosedSlot(day.dateValue, timeLabel, referenceSlot); return <div key={day.dateValue} className="border-l border-border p-2"><CalendarCell slot={slot} onOpen={() => onSelect(day.dateValue, slot)} /></div>; })}</div>)}</div></div>;
}

function createClosedSlot(dateValue: string, timeLabel: string, referenceSlot: AdminAppointmentCalendarSlot): AdminAppointmentCalendarSlot {
  return { id: `closed:${referenceSlot.doctorId}:${dateValue}:${timeLabel}`, doctorId: referenceSlot.doctorId, doctorName: referenceSlot.doctorName, availabilityId: "", scheduledAtIso: new Date(`${dateValue}T${timeLabel}:00+07:00`).toISOString(), timeLabel, status: "closed", statusLabel: "-", lockExpiresAt: null };
}

function CalendarCell({ slot, onOpen }: { slot: AdminAppointmentCalendarSlot; onOpen: () => void }) {
  const presentation = statusPresentation[slot.status];
  return <button type="button" onClick={onOpen} aria-label={`จัดการช่วงเวลา ${slot.timeLabel}: ${presentation.label}`} className={`min-h-16 w-full rounded-[8px] border p-2 text-left ${presentation.className}`}><span className="flex items-start justify-between gap-2"><span className="text-xs font-bold">{presentation.label}</span><span className="rounded-[6px] bg-white/75 p-1 text-primary shadow-sm"><Plus className="size-3.5" /></span></span>{slot.lockExpiresAt ? <span className="mt-1 block text-[10px] font-semibold text-warning">ล็อกถึง {slot.lockExpiresAt}</span> : null}</button>;
}
