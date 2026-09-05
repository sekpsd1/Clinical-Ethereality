"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Clock3, Plus, Stethoscope } from "lucide-react";
import { AdminCalendarSlotDrawer } from "@/features/admin/AdminCalendarSlotDrawer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AdminAppointmentCalendarData, AdminAppointmentCalendarSlot, AdminDoctorAvailabilityDateOverride, AdminDoctorOption, AdminManualAppointmentPatient } from "@/features/admin/schedules/types";

const statusPresentation = {
  available: { label: "ว่าง", tone: "success" },
  pending_payment: { label: "ไม่ว่าง", tone: "danger" },
  scheduled: { label: "ไม่ว่าง", tone: "danger" },
  live: { label: "ไม่ว่าง", tone: "danger" },
  closed: { label: "ปิดรับนัด", tone: "neutral" }
} as const;

function moveDate(value: string, view: AdminAppointmentCalendarData["view"], direction: -1 | 1) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + direction * (view === "day" ? 1 : view === "week" ? 7 : 1));
  return date.toISOString().slice(0, 10);
}

export function AdminAppointmentCalendar({ data, manualAppointmentPatients, workingHoursDoctors, dateOverrides }: { data: AdminAppointmentCalendarData; manualAppointmentPatients: AdminManualAppointmentPatient[]; workingHoursDoctors: AdminDoctorOption[]; dateOverrides: AdminDoctorAvailabilityDateOverride[] }) {
  const [selectedSlot, setSelectedSlot] = useState<{ dateValue: string; slot: AdminAppointmentCalendarSlot } | null>(null);
  const calendarHref = (date: string, view = data.view) => ({ pathname: "/admin/schedules", query: { doctor: data.selectedDoctorId, date, view }, hash: "doctor-schedule" });
  const selectedDoctorName = data.doctors.find((doctor) => doctor.id === data.selectedDoctorId)?.name ?? "แพทย์ที่เลือก";
  const openUnconfiguredDay = (dateValue: string) => setSelectedSlot({ dateValue, slot: { id: `unconfigured-${dateValue}`, doctorId: data.selectedDoctorId, doctorName: selectedDoctorName, availabilityId: "", scheduledAtIso: `${dateValue}T00:00:00.000Z`, timeLabel: "ยังไม่กำหนดเวลา", status: "closed", statusLabel: "ปิดรับนัด", lockExpiresAt: null } });

  return <section id="doctor-schedule" className="scroll-mt-4 rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
    <div className="flex items-start justify-between gap-3"><div><p className="text-label font-bold uppercase text-primary">ขั้นตอนที่ 2</p><h2 className="mt-1 font-headline text-lg font-bold text-text">ปฏิทินนัดหมายแพทย์</h2><p className="mt-1 text-xs leading-5 text-muted">แสดงเฉพาะสถานะช่วงเวลา ไม่แสดงข้อมูลผู้ป่วยบนปฏิทิน</p></div><CalendarDays aria-hidden="true" className="size-5 shrink-0 text-primary" /></div>
    <form action="/admin/schedules#doctor-schedule" method="get" className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><input type="hidden" name="date" value={data.dateValue} /><input type="hidden" name="view" value={data.view} /><label className="text-xs font-bold text-text">เลือกแพทย์<select required name="doctor" defaultValue={data.selectedDoctorId} className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text"><option value="">เลือกแพทย์เพื่อดูปฏิทิน</option>{data.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label><button type="submit" className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-primary px-4 text-sm font-bold text-white"><Stethoscope aria-hidden="true" className="size-4" />แสดงปฏิทิน</button></form>
    {!data.selectedDoctorId ? <p className="mt-4 rounded-[8px] border border-dashed border-border bg-white/65 p-4 text-center text-xs font-semibold leading-5 text-muted">กรุณาเลือกแพทย์ก่อนดูสถานะเวลานัดหมาย</p> : <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3"><div className="flex gap-1">{(["day", "week", "month"] as const).map((view) => <Link key={view} href={calendarHref(data.dateValue, view)} className={`rounded-[8px] px-3 py-2 text-xs font-bold ${data.view === view ? "bg-primary text-white" : "bg-surface text-primary"}`}>{view === "day" ? "วัน" : view === "week" ? "สัปดาห์" : "เดือน"}</Link>)}</div><div className="flex items-center gap-2 text-xs font-bold text-text"><Link href={calendarHref(moveDate(data.dateValue, data.view, -1))} className="rounded-[8px] border border-border px-2 py-1">ก่อนหน้า</Link><span>{data.dateLabel}</span><Link href={calendarHref(moveDate(data.dateValue, data.view, 1))} className="rounded-[8px] border border-border px-2 py-1">ถัดไป</Link></div></div>
      <div className={`mt-3 gap-3 ${data.view === "month" ? "grid grid-cols-2 sm:grid-cols-4" : "space-y-3"}`}>{data.days.map((day) => <section key={day.dateValue} className="rounded-[8px] border border-border bg-white p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold text-text">{day.dateLabel}</p><StatusBadge tone={day.slots.length ? "success" : "neutral"}>{day.slots.length} ช่วง</StatusBadge></div>{day.slots.length === 0 ? <div className="mt-2 flex items-center justify-between gap-2 rounded-[8px] bg-surface px-2 py-2"><StatusBadge tone="neutral">ปิดรับนัด</StatusBadge><button type="button" onClick={() => openUnconfiguredDay(day.dateValue)} aria-label={`จัดการเวลาวันที่ ${day.dateLabel}`} className="rounded-[8px] border border-primary/30 p-1.5 text-primary"><Plus className="size-3.5" /></button></div> : <div className="mt-2 divide-y divide-border/70">{day.slots.map((slot) => { const presentation = statusPresentation[slot.status]; return <article key={slot.id} className="flex items-center gap-2 py-2"><Clock3 aria-hidden="true" className="size-3.5 text-primary" /><span className="min-w-12 text-xs font-bold text-text">{slot.timeLabel}</span><StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge>{slot.lockExpiresAt ? <span className="ml-auto text-[10px] font-semibold text-warning">ล็อกถึง {slot.lockExpiresAt}</span> : null}<button type="button" onClick={() => setSelectedSlot({ dateValue: day.dateValue, slot })} aria-label={`จัดการช่วงเวลา ${slot.timeLabel}`} className="ml-auto rounded-[8px] border border-primary/30 p-1.5 text-primary"><Plus className="size-3.5" /></button></article>; })}</div>}</section>)}</div>
    </>}
    {selectedSlot ? <AdminCalendarSlotDrawer dateValue={selectedSlot.dateValue} patients={manualAppointmentPatients} slot={selectedSlot.slot} doctors={workingHoursDoctors} overrides={dateOverrides} onClose={() => setSelectedSlot(null)} /> : null}
  </section>;
}
