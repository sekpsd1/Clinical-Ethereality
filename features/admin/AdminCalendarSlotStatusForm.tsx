"use client";

import { useActionState } from "react";
import { setDoctorCalendarSlotStatusAction, type AdminScheduleActionState } from "@/features/admin/schedules/actions";
import type { AdminAppointmentCalendarSlot } from "@/features/admin/schedules/types";

const initialState: AdminScheduleActionState = { status: "idle", message: "" };
const appointmentStatuses = new Set<AdminAppointmentCalendarSlot["status"]>(["pending_payment", "scheduled", "live"]);

function formatBangkokTime(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(value);
}

export function AdminCalendarSlotStatusForm({ dateValue, slot }: { dateValue: string; slot: AdminAppointmentCalendarSlot }) {
  const [state, action, isPending] = useActionState(setDoctorCalendarSlotStatusAction, initialState);
  const isAppointment = appointmentStatuses.has(slot.status);
  const endTime = formatBangkokTime(new Date(new Date(slot.scheduledAtIso).getTime() + slot.slotMinutes * 60 * 1000));
  const options = [
    { value: "available", label: "ว่าง", detail: "เปิดให้จองช่วงเวลานี้" },
    { value: "blocked", label: "ไม่ว่าง", detail: "บล็อกเฉพาะช่วงเวลานี้" },
    { value: "closed", label: "-", detail: "ปิดทั้งวันที่เลือก" }
  ] as const;

  return <div className="rounded-[8px] border border-border bg-surface/45 p-3">
    <p className="text-xs font-bold text-text">สถานะช่องเวลา</p>
    {isAppointment ? <p className="mt-2 rounded-[8px] bg-[#ba1a1a]/10 px-3 py-2 text-xs font-semibold leading-5 text-[#93000a]">สถานะ “{slot.statusLabel}” มาจากนัดหมายจริง จึงไม่อนุญาตให้เปลี่ยนหรือลบสถานะจากปฏิทิน กรุณาจัดการนัดหมายผ่านขั้นตอนของนัดหมายนั้น</p> : <p className="mt-1 text-[11px] leading-5 text-muted">เลือก “ไม่ว่าง” เพื่อบล็อกเฉพาะ {slot.timeLabel}-{endTime} หรือเลือก “-” เพื่อปิดทั้งวันที่ {dateValue}</p>}
    <form action={action} className="mt-3 grid grid-cols-3 gap-2">
      <input type="hidden" name="doctorId" value={slot.doctorId} />
      <input type="hidden" name="scheduleDate" value={dateValue} />
      <input type="hidden" name="startTime" value={slot.timeLabel} />
      <input type="hidden" name="endTime" value={endTime} />
      <input type="hidden" name="slotMinutes" value={slot.slotMinutes} />
      {options.map((option) => <button key={option.value} type="submit" name="targetStatus" value={option.value} disabled={isPending || isAppointment || slot.status === option.value} title={option.detail} className={`min-h-14 rounded-[8px] border px-2 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-45 ${option.value === "closed" ? "border-border bg-white text-muted" : option.value === "blocked" ? "border-[#ba1a1a]/30 bg-[#ba1a1a]/5 text-[#93000a]" : "border-primary/30 bg-primary/5 text-primary"}`}><span className="block">{option.label}</span><span className="mt-0.5 block text-[9px] font-semibold">{option.detail}</span></button>)}
    </form>
    {state.status !== "idle" ? <p className={`mt-3 rounded-[8px] px-3 py-2 text-xs font-semibold ${state.status === "success" ? "bg-primary/10 text-primary" : "bg-[#ba1a1a]/10 text-[#93000a]"}`}>{state.message}</p> : null}
  </div>;
}
