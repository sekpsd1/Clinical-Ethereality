"use client";

import { useActionState, useMemo } from "react";
import { CalendarPlus } from "lucide-react";
import { createDoctorAvailabilityDateOverrideAction, type AdminScheduleActionState } from "@/features/admin/schedules/actions";
import { AdminDateScheduleCopyForm } from "@/features/admin/AdminDateScheduleCopyForm";
import type { AdminDoctorAvailabilityDateOverride, AdminDoctorOption } from "@/features/admin/schedules/types";

const initialState: AdminScheduleActionState = { status: "idle", message: "" };
const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const value = `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 === 0 ? "00" : "30"}`;
  return { value, label: `${value} น.` };
});

export function AdminDateScheduleEditor({ doctors, overrides, selectedDate, selectedDoctorId }: { doctors: AdminDoctorOption[]; overrides: AdminDoctorAvailabilityDateOverride[]; selectedDate: string; selectedDoctorId: string }) {
  const [createState, createAction, isCreating] = useActionState(createDoctorAvailabilityDateOverrideAction, initialState);
  const doctorId = selectedDoctorId;
  const selectedDayLabel = useMemo(() => new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${selectedDate}T00:00:00.000Z`)), [selectedDate]);

  const dailyOverrides = overrides.filter((item) => item.scheduleDateValue === selectedDate && item.doctorId === doctorId);
  const state = createState;
  const isPending = isCreating;
  const isDisabled = doctors.length === 0 || !doctorId || isPending;

  return (
    <section id="date-schedule-form" className="scroll-mt-4 rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary"><CalendarPlus aria-hidden="true" className="size-5" /></span>
        <div><h2 className="font-headline text-lg font-bold text-text">จัดการเวลาตรวจของวันนั้น</h2></div>
      </div>

      <div className="mt-4 rounded-[8px] bg-primary/5 px-3 py-2 text-xs font-semibold text-text">วันที่เลือก: {selectedDayLabel}</div>
      <label className="mt-3 block"><span className="text-[11px] font-bold text-muted">แพทย์</span><select defaultValue={doctorId} disabled className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none disabled:opacity-70"><option value="">กรุณาเลือกแพทย์จากตารางด้านบน</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name} / {doctor.specialty}</option>)}</select></label>

      <form action={createAction} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input type="hidden" name="doctorId" value={doctorId} /><input type="hidden" name="scheduleDate" value={selectedDate} /><input type="hidden" name="type" value="available" />
        <label className="block"><span className="text-[11px] font-bold text-muted">เริ่ม</span><select name="startTime" defaultValue="09:00" disabled={isDisabled} className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text">{timeOptions.map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select></label>
        <label className="block"><span className="text-[11px] font-bold text-muted">สิ้นสุด</span><select name="endTime" defaultValue="11:00" disabled={isDisabled} className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text">{timeOptions.map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select></label>
        <label className="block sm:col-span-2"><span className="text-[11px] font-bold text-muted">ระยะเวลาต่อรอบ</span><select name="slotMinutes" defaultValue="60" disabled={isDisabled} className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text"><option value="15">15 นาที</option><option value="30">30 นาที</option><option value="45">45 นาที</option><option value="60">60 นาที</option></select></label>
        <label className="block sm:col-span-2"><span className="text-[11px] font-bold text-muted">หมายเหตุ</span><input name="notes" disabled={isDisabled} placeholder="เช่น เปิดตรวจเพิ่ม" className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary" /></label>
        {state.status !== "idle" ? <p className={`sm:col-span-2 rounded-[8px] px-3 py-2 text-xs font-semibold ${state.status === "success" ? "bg-primary/10 text-primary" : "bg-[#ba1a1a]/10 text-[#93000a]"}`}>{state.message}</p> : null}
        <div className="sm:col-span-2"><button type="submit" disabled={isDisabled} className="h-11 w-full rounded-full bg-primary-gradient text-sm font-bold text-white shadow-payment-active disabled:opacity-50">{isPending ? "กำลังบันทึก..." : "เพิ่มช่วงเวลาตรวจ"}</button></div>
      </form>

      {doctorId ? <AdminDateScheduleCopyForm doctorId={doctorId} sourceDate={selectedDate} sourceOverrides={dailyOverrides} /> : null}
    </section>
  );
}
