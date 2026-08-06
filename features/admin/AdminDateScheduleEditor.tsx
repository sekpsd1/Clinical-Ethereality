"use client";

import { useActionState, useState } from "react";
import { CalendarOff } from "lucide-react";
import { createDoctorAvailabilityDateOverrideAction, type AdminScheduleActionState } from "@/features/admin/schedules/actions";
import type { AdminDoctorOption } from "@/features/admin/schedules/types";

const initialState: AdminScheduleActionState = { status: "idle", message: "" };
const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const value = `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 === 0 ? "00" : "30"}`;
  return { value, label: `${value} น.` };
});

export function AdminDateScheduleEditor({ doctors }: { doctors: AdminDoctorOption[] }) {
  const [state, action, isPending] = useActionState(createDoctorAvailabilityDateOverrideAction, initialState);
  const [type, setType] = useState<"available" | "closed">("available");
  const isDisabled = doctors.length === 0 || isPending;

  return (
    <section className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
          <CalendarOff aria-hidden="true" className="size-5" />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">ตารางพิเศษตามวันที่</p>
          <h2 className="mt-1 font-headline text-lg font-bold text-text">กำหนดวันหยุดหรือเวลาพิเศษ</h2>
          <p className="mt-1 text-xs leading-5 text-muted">เวลาพิเศษจะเพิ่มจากตารางประจำ ส่วนวันหยุดจะปิดเวลาว่างทั้งหมดของวันที่เลือก</p>
        </div>
      </div>

      <form action={action} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] font-bold text-muted">แพทย์</span>
          <select name="doctorId" required disabled={isDisabled} defaultValue="" className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary disabled:opacity-50">
            <option value="" disabled>กรุณาเลือกแพทย์</option>
            {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name} / {doctor.specialty}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-bold text-muted">วันที่</span>
          <input name="scheduleDate" type="date" required disabled={isDisabled} className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary disabled:opacity-50" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[11px] font-bold text-muted">กำหนดเป็น</span>
          <select name="type" value={type} disabled={isDisabled} onChange={(event) => setType(event.target.value as "available" | "closed")} className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary disabled:opacity-50">
            <option value="available">เปิดเวลาพิเศษ</option>
            <option value="closed">วันหยุด (ปิดทั้งวัน)</option>
          </select>
        </label>
        {type === "available" ? (
          <>
            <label className="block"><span className="text-[11px] font-bold text-muted">เริ่ม</span><select name="startTime" defaultValue="09:00" disabled={isDisabled} className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text">{timeOptions.map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select></label>
            <label className="block"><span className="text-[11px] font-bold text-muted">สิ้นสุด</span><select name="endTime" defaultValue="11:00" disabled={isDisabled} className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text">{timeOptions.map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select></label>
            <label className="block sm:col-span-2"><span className="text-[11px] font-bold text-muted">ระยะเวลาต่อรอบ</span><select name="slotMinutes" defaultValue="60" disabled={isDisabled} className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text"><option value="15">15 นาที</option><option value="30">30 นาที</option><option value="45">45 นาที</option><option value="60">60 นาที</option></select></label>
          </>
        ) : null}
        <label className="block sm:col-span-2"><span className="text-[11px] font-bold text-muted">หมายเหตุ</span><input name="notes" disabled={isDisabled} placeholder="เช่น วันหยุดนักขัตฤกษ์" className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary disabled:opacity-50" /></label>
        {state.status !== "idle" ? <p className={`sm:col-span-2 rounded-[8px] px-3 py-2 text-xs font-semibold ${state.status === "success" ? "bg-primary/10 text-primary" : "bg-[#ba1a1a]/10 text-[#93000a]"}`}>{state.message}</p> : null}
        <button type="submit" disabled={isDisabled} className="sm:col-span-2 h-11 rounded-full bg-primary-gradient text-sm font-bold text-white shadow-payment-active disabled:opacity-50">{isPending ? "กำลังบันทึก..." : "บันทึกตารางพิเศษ"}</button>
      </form>
    </section>
  );
}
