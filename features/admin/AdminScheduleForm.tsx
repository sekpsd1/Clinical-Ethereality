"use client";

import { useActionState } from "react";
import { CalendarPlus } from "lucide-react";
import { upsertDoctorAvailabilityAction, type AdminScheduleActionState } from "@/features/admin/schedules/actions";
import type { AdminDoctorOption } from "@/features/admin/schedules/types";

const initialState: AdminScheduleActionState = {
  status: "idle",
  message: ""
};

const weekdays = [
  { value: 0, label: "อาทิตย์" },
  { value: 1, label: "จันทร์" },
  { value: 2, label: "อังคาร" },
  { value: 3, label: "พุธ" },
  { value: 4, label: "พฤหัสบดี" },
  { value: 5, label: "ศุกร์" },
  { value: 6, label: "เสาร์" }
] as const;

export function AdminScheduleForm({ doctors }: { doctors: AdminDoctorOption[] }) {
  const [state, action, isPending] = useActionState(upsertDoctorAvailabilityAction, initialState);
  const isDisabled = doctors.length === 0 || isPending;

  return (
    <form action={action} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
          <CalendarPlus aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="font-headline text-lg font-bold text-text">เพิ่มเวลาว่างแพทย์</h2>
          <p className="mt-1 text-xs leading-5 text-muted">ใช้สำหรับกำหนด slot ที่ทีม admin สามารถเปิดรับนัดหมายได้</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">แพทย์</span>
          <select
            name="doctorId"
            disabled={isDisabled}
            className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary"
            required
          >
            {doctors.length === 0 ? <option value="">ยังไม่มีแพทย์ที่อนุมัติแล้ว</option> : null}
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name} / {doctor.specialty}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">วัน</span>
            <select
              name="weekday"
              disabled={isDisabled}
              className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary"
            >
              {weekdays.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">ระยะ slot</span>
            <select
              name="slotMinutes"
              disabled={isDisabled}
              className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary"
              defaultValue="30"
            >
              <option value="15">15 นาที</option>
              <option value="30">30 นาที</option>
              <option value="45">45 นาที</option>
              <option value="60">60 นาที</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">เริ่ม</span>
            <input
              name="startTime"
              type="time"
              disabled={isDisabled}
              defaultValue="09:00"
              className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary"
              required
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">สิ้นสุด</span>
            <input
              name="endTime"
              type="time"
              disabled={isDisabled}
              defaultValue="12:00"
              className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary"
              required
            />
          </label>
        </div>

        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">หมายเหตุ</span>
          <input
            name="notes"
            disabled={isDisabled}
            placeholder="เช่น รับเฉพาะ follow-up หรือ teleconsult"
            className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary"
          />
        </label>

        <label className="flex items-center gap-2 text-sm font-semibold text-text">
          <input name="isActive" type="checkbox" defaultChecked disabled={isDisabled} className="size-4 accent-primary" />
          เปิดใช้งานทันที
        </label>
      </div>

      {state.status !== "idle" ? (
        <p className={`mt-3 rounded-[8px] px-3 py-2 text-xs font-semibold ${state.status === "success" ? "bg-primary/10 text-primary" : "bg-[#ba1a1a]/10 text-[#93000a]"}`}>
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isDisabled}
        className="mt-4 h-11 w-full rounded-full bg-primary-gradient text-sm font-bold text-white shadow-payment-active disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "กำลังบันทึก..." : "บันทึกเวลาว่าง"}
      </button>
    </form>
  );
}
