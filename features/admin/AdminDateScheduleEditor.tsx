"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { CalendarPlus, Pencil, X } from "lucide-react";
import { createDoctorAvailabilityDateOverrideAction, type AdminScheduleActionState, updateDoctorAvailabilityDateOverrideAction } from "@/features/admin/schedules/actions";
import { AdminDateScheduleCopyForm } from "@/features/admin/AdminDateScheduleCopyForm";
import type { AdminDoctorAvailabilityDateOverride, AdminDoctorOption } from "@/features/admin/schedules/types";

const initialState: AdminScheduleActionState = { status: "idle", message: "" };
const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const value = `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 === 0 ? "00" : "30"}`;
  return { value, label: `${value} น.` };
});

export function AdminDateScheduleEditor({ doctors, overrides, selectedDate, selectedDoctorId }: { doctors: AdminDoctorOption[]; overrides: AdminDoctorAvailabilityDateOverride[]; selectedDate: string; selectedDoctorId: string }) {
  const [createState, createAction, isCreating] = useActionState(createDoctorAvailabilityDateOverrideAction, initialState);
  const [updateState, updateAction, isUpdating] = useActionState(updateDoctorAvailabilityDateOverrideAction, initialState);
  const [doctorId, setDoctorId] = useState(selectedDoctorId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const selectedDayLabel = useMemo(() => new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${selectedDate}T00:00:00.000Z`)), [selectedDate]);

  useEffect(() => {
    setDoctorId(selectedDoctorId);
    setEditingId(null);
  }, [selectedDate, selectedDoctorId]);

  const dailyOverrides = overrides.filter((item) => item.scheduleDateValue === selectedDate && item.doctorId === doctorId);
  const editingOverride = dailyOverrides.find((item) => item.id === editingId) ?? null;
  const state = editingOverride ? updateState : createState;
  const isPending = editingOverride ? isUpdating : isCreating;
  const isDisabled = doctors.length === 0 || !doctorId || isPending;

  return (
    <section id="date-schedule-form" className="scroll-mt-4 rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary"><CalendarPlus aria-hidden="true" className="size-5" /></span>
        <div><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">ขั้นตอนที่ 3</p><h2 className="mt-1 font-headline text-lg font-bold text-text">จัดการเวลาตรวจของวันนั้น</h2><p className="mt-1 text-xs leading-5 text-muted">เพิ่มหรือแก้ไขเฉพาะเวลาพิเศษของแพทย์ในวันที่เลือก ระบบจะไม่ลดหรือลบช่วงที่มีนัดหมายแล้ว</p></div>
      </div>

      <div className="mt-4 rounded-[8px] bg-primary/5 px-3 py-2 text-xs font-semibold text-text">วันที่เลือก: {selectedDayLabel}</div>
      <label className="mt-3 block"><span className="text-[11px] font-bold text-muted">แพทย์</span><select value={doctorId} onChange={(event) => { setDoctorId(event.target.value); setEditingId(null); }} disabled={doctors.length === 0 || isPending} className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary disabled:opacity-50"><option value="">กรุณาเลือกแพทย์จากตารางด้านบน</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name} / {doctor.specialty}</option>)}</select></label>

      {doctorId ? <div className="mt-3 rounded-[8px] border border-border bg-white p-3 text-xs"><p className="font-bold text-text">เวลาพิเศษที่บันทึกไว้สำหรับแพทย์คนนี้</p>{dailyOverrides.length === 0 ? <p className="mt-1 text-muted">ยังไม่มีตารางพิเศษของวันนี้ สามารถเพิ่มช่วงเวลาตรวจได้ด้านล่าง</p> : <div className="mt-2 space-y-2">{dailyOverrides.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-[8px] bg-surface p-2"><p className="font-semibold text-text">{item.type === "closed" ? "วันหยุด (ปิดทั้งวัน)" : `${item.timeRange} • รอบละ ${item.slotMinutes} นาที`}</p><button type="button" onClick={() => setEditingId(item.id)} className="inline-flex min-h-8 items-center gap-1 rounded-[8px] border border-border px-2 text-xs font-bold text-primary"><Pencil aria-hidden="true" className="size-3" />แก้ไข</button></div>)}</div>}</div> : null}

      <form key={editingOverride?.id ?? "new"} action={editingOverride ? updateAction : createAction} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input type="hidden" name="doctorId" value={doctorId} /><input type="hidden" name="scheduleDate" value={selectedDate} />{editingOverride ? <input type="hidden" name="overrideId" value={editingOverride.id} /> : null}
        <label className="block sm:col-span-2"><span className="text-[11px] font-bold text-muted">กำหนดเป็น</span><select name="type" defaultValue={editingOverride?.type ?? "available"} disabled={isDisabled} className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text"><option value="available">เปิดเวลาพิเศษ</option><option value="closed">วันหยุด (ปิดทั้งวัน)</option></select></label>
        <label className="block"><span className="text-[11px] font-bold text-muted">เริ่ม</span><select name="startTime" defaultValue={editingOverride?.type === "available" ? editingOverride.timeRange.slice(0, 5) : "09:00"} disabled={isDisabled} className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text">{timeOptions.map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select></label>
        <label className="block"><span className="text-[11px] font-bold text-muted">สิ้นสุด</span><select name="endTime" defaultValue={editingOverride?.type === "available" ? editingOverride.timeRange.slice(6, 11) : "11:00"} disabled={isDisabled} className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text">{timeOptions.map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select></label>
        <label className="block sm:col-span-2"><span className="text-[11px] font-bold text-muted">ระยะเวลาต่อรอบ</span><select name="slotMinutes" defaultValue={editingOverride?.slotMinutes ?? "60"} disabled={isDisabled} className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text"><option value="15">15 นาที</option><option value="30">30 นาที</option><option value="45">45 นาที</option><option value="60">60 นาที</option></select></label>
        <label className="block sm:col-span-2"><span className="text-[11px] font-bold text-muted">หมายเหตุ</span><input name="notes" defaultValue={editingOverride?.notes === "-" ? "" : editingOverride?.notes} disabled={isDisabled} placeholder="เช่น เปิดตรวจเพิ่ม" className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary" /></label>
        <p className="sm:col-span-2 text-[11px] leading-5 text-muted">หากเลือก “วันหยุด” ระบบจะไม่ใช้เวลาเริ่ม–สิ้นสุด และจะป้องกันการเปลี่ยนแปลงเมื่อมีนัดอยู่แล้ว</p>
        {state.status !== "idle" ? <p className={`sm:col-span-2 rounded-[8px] px-3 py-2 text-xs font-semibold ${state.status === "success" ? "bg-primary/10 text-primary" : "bg-[#ba1a1a]/10 text-[#93000a]"}`}>{state.message}</p> : null}
        <div className="sm:col-span-2 flex flex-col gap-2 sm:flex-row"><button type="submit" disabled={isDisabled} className="h-11 flex-1 rounded-full bg-primary-gradient text-sm font-bold text-white shadow-payment-active disabled:opacity-50">{isPending ? "กำลังบันทึก..." : editingOverride ? "บันทึกการแก้ไข" : "เพิ่มช่วงเวลาตรวจ"}</button>{editingOverride ? <button type="button" onClick={() => setEditingId(null)} disabled={isPending} className="inline-flex h-11 items-center justify-center gap-1 rounded-full border border-border px-4 text-sm font-bold text-primary"><X aria-hidden="true" className="size-4" />ยกเลิก</button> : null}</div>
      </form>

      {doctorId ? <AdminDateScheduleCopyForm doctorId={doctorId} sourceDate={selectedDate} sourceOverrides={dailyOverrides} /> : null}
    </section>
  );
}
