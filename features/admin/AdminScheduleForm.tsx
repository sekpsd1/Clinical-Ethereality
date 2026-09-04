"use client";

import { useActionState } from "react";
import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import { AdminDayMonthYearDateField } from "@/features/admin/AdminAppointmentDateField";
import { upsertDoctorAvailabilityAction, type AdminScheduleActionState } from "@/features/admin/schedules/actions";
import type { AdminDoctorAvailabilitySlot, AdminDoctorOption } from "@/features/admin/schedules/types";

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

const timeOptions = Array.from({ length: 24 * 4 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minutes = (index % 4) * 15;
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  return {
    value,
    label: `${value} น.`
  };
});

export function AdminScheduleForm({
  doctors,
  editSlot
}: {
  doctors: AdminDoctorOption[];
  editSlot?: AdminDoctorAvailabilitySlot;
}) {
  const [state, action, isPending] = useActionState(upsertDoctorAvailabilityAction, initialState);
  const isDisabled = doctors.length === 0 || isPending;

  return (
    <form
      id="schedule-form"
      action={action}
      className="scroll-mt-4 rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card"
    >
      {editSlot ? <input type="hidden" name="availabilityId" value={editSlot.id} /> : null}
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
          <CalendarPlus aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="font-headline text-lg font-bold text-text">
            {editSlot ? "แก้ไขเวลาว่างแพทย์" : "เพิ่มเวลาว่างแพทย์"}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            {editSlot
              ? "แก้ไขวัน เวลา และระยะเวลาต่อรอบของรายการเดิม โดยนัดหมายที่ยืนยันแล้วจะไม่ถูกลบ"
              : "ใช้สำหรับกำหนดช่วงเวลาที่ทีมผู้ดูแลสามารถเปิดรับนัดหมายได้"}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">แพทย์</span>
          <select
            name="doctorId"
            disabled={isDisabled}
            defaultValue={editSlot?.doctorId}
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
              defaultValue={editSlot?.weekday ?? 0}
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
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">ระยะเวลาต่อรอบ</span>
            <select
              name="slotMinutes"
              disabled={isDisabled}
              className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary"
              defaultValue={editSlot?.slotMinutes ?? 30}
            >
              <option value="15">15 นาที</option>
              <option value="30">30 นาที</option>
              <option value="45">45 นาที</option>
              <option value="60">60 นาที</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <AdminDayMonthYearDateField initialValue={editSlot?.effectiveFromValue ?? ""} name="effectiveFrom" label="มีผลตั้งแต่ (ไม่บังคับ)" labelClassName="block text-[11px] font-bold uppercase tracking-[0.08em] text-muted" disabled={isDisabled} />
          <AdminDayMonthYearDateField initialValue={editSlot?.effectiveToValue ?? ""} name="effectiveTo" label="ถึงวันที่ (ไม่บังคับ)" labelClassName="block text-[11px] font-bold uppercase tracking-[0.08em] text-muted" disabled={isDisabled} />
        </div>
        <p className="-mt-1 text-[11px] leading-5 text-muted">เว้นว่างเพื่อใช้ตารางประจำต่อเนื่อง</p>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">เริ่ม (24 ชั่วโมง)</span>
            <select
              name="startTime"
              disabled={isDisabled}
              defaultValue={editSlot?.startTime ?? "09:00"}
              className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary"
              required
            >
              {timeOptions.map((time) => (
                <option key={time.value} value={time.value}>
                  {time.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">สิ้นสุด (24 ชั่วโมง)</span>
            <select
              name="endTime"
              disabled={isDisabled}
              defaultValue={editSlot?.endTime ?? "12:00"}
              className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary"
              required
            >
              {timeOptions.map((time) => (
                <option key={time.value} value={time.value}>
                  {time.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">หมายเหตุ</span>
          <input
            name="notes"
            disabled={isDisabled}
            defaultValue={editSlot?.notes === "-" ? "" : editSlot?.notes}
            placeholder="เช่น รับเฉพาะติดตามอาการ หรือปรึกษาออนไลน์"
            className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary"
          />
        </label>

        <label className="flex items-center gap-2 text-sm font-semibold text-text">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={editSlot?.isActive ?? true}
            disabled={isDisabled}
            className="size-4 accent-primary"
          />
          เปิดใช้งานทันที
        </label>
      </div>

      {state.status !== "idle" ? (
        <p className={`mt-3 rounded-[8px] px-3 py-2 text-xs font-semibold ${state.status === "success" ? "bg-primary/10 text-primary" : "bg-[#ba1a1a]/10 text-[#93000a]"}`}>
          {state.message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={isDisabled}
          className="h-11 flex-1 rounded-full bg-primary-gradient text-sm font-bold text-white shadow-payment-active disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "กำลังบันทึก..." : editSlot ? "บันทึกการแก้ไข" : "บันทึกเวลาว่าง"}
        </button>
        {editSlot ? (
          <Link
            href="/admin/schedules#schedule-form"
            className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-white px-5 text-sm font-bold text-primary"
          >
            ยกเลิกการแก้ไข
          </Link>
        ) : null}
      </div>
    </form>
  );
}
