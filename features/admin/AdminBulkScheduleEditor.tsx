"use client";

import { useActionState, useMemo, useState } from "react";
import { CalendarDays, CopyPlus, Plus, Trash2 } from "lucide-react";
import { createDoctorAvailabilityBatchAction, type AdminScheduleActionState } from "@/features/admin/schedules/actions";
import { AdminDayMonthYearDateField } from "@/features/admin/AdminAppointmentDateField";
import type { AdminDoctorOption } from "@/features/admin/schedules/types";

type DraftBlock = {
  id: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
};

const initialState: AdminScheduleActionState = {
  status: "idle",
  message: ""
};

const weekdays = [
  { value: 1, label: "จันทร์" },
  { value: 2, label: "อังคาร" },
  { value: 3, label: "พุธ" },
  { value: 4, label: "พฤหัสบดี" },
  { value: 5, label: "ศุกร์" },
  { value: 6, label: "เสาร์" },
  { value: 0, label: "อาทิตย์" }
] as const;

const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const totalMinutes = index * 30;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  const value = `${hours}:${minutes}`;

  return { value, label: `${value} น.` };
});

let nextBlockId = 2;

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getBlockStarts(block: DraftBlock): string[] {
  const start = timeToMinutes(block.startTime);
  const end = timeToMinutes(block.endTime);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || (end - start) % block.slotMinutes !== 0) {
    return [];
  }

  return Array.from({ length: (end - start) / block.slotMinutes }, (_, index) => {
    const minutes = start + index * block.slotMinutes;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  });
}

export function AdminBulkScheduleEditor({ doctors }: { doctors: AdminDoctorOption[] }) {
  const [state, action, isPending] = useActionState(createDoctorAvailabilityBatchAction, initialState);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1]);
  const [blocks, setBlocks] = useState<DraftBlock[]>([
    {
      id: 1,
      startTime: "09:00",
      endTime: "11:00",
      slotMinutes: 60
    }
  ]);
  const [copiedToSelection, setCopiedToSelection] = useState(false);

  const preview = useMemo(
    () =>
      weekdays
        .filter((day) => selectedWeekdays.includes(day.value))
        .map((day) => ({
          label: day.label,
          starts: blocks.flatMap(getBlockStarts)
        })),
    [blocks, selectedWeekdays]
  );

  const appointmentCount = preview.reduce((total, day) => total + day.starts.length, 0);
  const isDisabled = doctors.length === 0 || isPending;

  function markBlocksChanged() {
    setCopiedToSelection(false);
  }

  function toggleWeekday(weekday: number) {
    markBlocksChanged();
    setSelectedWeekdays((current) =>
      current.includes(weekday) ? current.filter((value) => value !== weekday) : [...current, weekday]
    );
  }

  function updateBlock(id: number, update: Partial<Omit<DraftBlock, "id">>) {
    markBlocksChanged();
    setBlocks((current) => current.map((block) => (block.id === id ? { ...block, ...update } : block)));
  }

  function addBlock() {
    markBlocksChanged();
    setBlocks((current) => [
      ...current,
      {
        id: nextBlockId++,
        startTime: "11:00",
        endTime: "11:30",
        slotMinutes: 30
      }
    ]);
  }

  function removeBlock(id: number) {
    if (blocks.length <= 1) {
      return;
    }

    markBlocksChanged();
    setBlocks((current) => current.filter((block) => block.id !== id));
  }

  return (
    <section className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
          <CalendarDays aria-hidden="true" className="size-5" />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">สร้างหลายรายการพร้อมกัน</p>
          <h2 className="mt-1 font-headline text-lg font-bold text-text">เพิ่มเวลาว่างแบบหลายวัน</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            เลือกแพทย์ครั้งเดียว แล้วคัดลอกช่วงเวลาเดียวกันไปยังวันที่เลือกก่อนบันทึกทั้งหมด
          </p>
        </div>
      </div>

      <form action={action} className="mt-4 space-y-4">
        {selectedWeekdays.map((weekday) => (
          <input key={weekday} type="hidden" name="weekdays" value={weekday} />
        ))}
        <input
          type="hidden"
          name="blocksJson"
          value={JSON.stringify(blocks.map(({ startTime, endTime, slotMinutes }) => ({ startTime, endTime, slotMinutes })))}
        />

        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">แพทย์</span>
          <select
            name="doctorId"
            disabled={isDisabled}
            defaultValue=""
            className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary disabled:opacity-50"
            required
          >
            <option value="" disabled>
              กรุณาเลือกแพทย์
            </option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name} / {doctor.specialty}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <AdminDayMonthYearDateField initialValue="" name="effectiveFrom" label="มีผลตั้งแต่" labelClassName="block text-[11px] font-bold uppercase tracking-[0.08em] text-muted" disabled={isDisabled} />
          <AdminDayMonthYearDateField initialValue="" name="effectiveTo" label="ถึงวันที่" labelClassName="block text-[11px] font-bold uppercase tracking-[0.08em] text-muted" disabled={isDisabled} />
        </div>
        <p className="-mt-2 text-[11px] leading-5 text-muted">ไม่บังคับ: ใช้เมื่อต้องการตั้งตารางประจำเพียงหลายสัปดาห์</p>

        <fieldset>
          <legend className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">เลือกวัน</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {weekdays.map((day) => {
              const checked = selectedWeekdays.includes(day.value);

              return (
                <label
                  key={day.value}
                  className={`flex min-h-10 cursor-pointer items-center justify-center rounded-[8px] border px-2 text-xs font-bold transition ${
                    checked ? "border-primary bg-primary/10 text-primary" : "border-border bg-white text-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isDisabled}
                    onChange={() => toggleWeekday(day.value)}
                    className="sr-only"
                  />
                  {day.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">ช่วงเวลา</p>
              <p className="mt-1 text-xs text-muted">ใช้เวลาแบบ 24 ชั่วโมง และกำหนดรอบนัดแยกในแต่ละช่วง</p>
            </div>
            <button
              type="button"
              onClick={addBlock}
              disabled={isDisabled}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[8px] border border-border bg-white px-3 text-xs font-bold text-primary disabled:opacity-50"
            >
              <Plus aria-hidden="true" className="size-3.5" />
              เพิ่มช่วง
            </button>
          </div>

          {blocks.map((block, index) => (
            <div key={block.id} className="rounded-[8px] border border-border/80 bg-[#f7fbfb] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-text">ช่วงที่ {index + 1}</p>
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  disabled={isDisabled || blocks.length === 1}
                  className="inline-flex min-h-8 items-center gap-1 rounded-[8px] px-2 text-xs font-bold text-[#93000a] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  ลบ
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="text-[11px] font-bold text-muted">เริ่ม</span>
                  <select
                    value={block.startTime}
                    disabled={isDisabled}
                    onChange={(event) => updateBlock(block.id, { startTime: event.target.value })}
                    className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary disabled:opacity-50"
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
                  <span className="text-[11px] font-bold text-muted">สิ้นสุด</span>
                  <select
                    value={block.endTime}
                    disabled={isDisabled}
                    onChange={(event) => updateBlock(block.id, { endTime: event.target.value })}
                    className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary disabled:opacity-50"
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
                  <span className="text-[11px] font-bold text-muted">ระยะเวลาต่อรอบ</span>
                  <select
                    value={block.slotMinutes}
                    disabled={isDisabled}
                    onChange={(event) => updateBlock(block.id, { slotMinutes: Number(event.target.value) })}
                    className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary disabled:opacity-50"
                  >
                    <option value={15}>15 นาที</option>
                    <option value={30}>30 นาที</option>
                    <option value={45}>45 นาที</option>
                    <option value={60}>60 นาที</option>
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>

        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">หมายเหตุ</span>
          <input
            name="notes"
            disabled={isDisabled}
            placeholder="เช่น ติดตามอาการ หรือปรึกษาออนไลน์"
            className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text outline-none focus:border-primary disabled:opacity-50"
          />
        </label>

        <label className="flex items-center gap-2 text-sm font-semibold text-text">
          <input name="isActive" type="checkbox" defaultChecked disabled={isDisabled} className="size-4 accent-primary" />
          เปิดใช้งานทันที
        </label>

        <div className="rounded-[8px] border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-text">ตัวอย่างรอบนัดก่อนบันทึก</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {selectedWeekdays.length === 0
                  ? "กรุณาเลือกอย่างน้อย 1 วัน"
                  : `${selectedWeekdays.length} วัน • ${blocks.length} ช่วงเวลา • ${appointmentCount} รอบนัดต่อสัปดาห์`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCopiedToSelection(true)}
              disabled={isDisabled || selectedWeekdays.length === 0 || appointmentCount === 0}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[8px] bg-primary px-3 text-xs font-bold text-white disabled:opacity-50"
            >
              <CopyPlus aria-hidden="true" className="size-3.5" />
              คัดลอกไปยังวันที่เลือก
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {preview.map((day) => (
              <div key={day.label} className="rounded-[8px] bg-white/80 px-3 py-2 text-xs">
                <span className="font-bold text-text">{day.label}: </span>
                <span className="font-semibold text-primary">{day.starts.length > 0 ? day.starts.join(", ") : "ตรวจสอบช่วงเวลา"}</span>
              </div>
            ))}
          </div>
          {copiedToSelection ? <p className="mt-3 text-xs font-bold text-primary">พร้อมบันทึกช่วงเวลาเดียวกันไปยังวันที่เลือกทั้งหมด</p> : null}
        </div>

        {state.status !== "idle" ? (
          <p className={`rounded-[8px] px-3 py-2 text-xs font-semibold ${state.status === "success" ? "bg-primary/10 text-primary" : "bg-[#ba1a1a]/10 text-[#93000a]"}`}>
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isDisabled || selectedWeekdays.length === 0 || appointmentCount === 0 || !copiedToSelection}
          className="h-11 w-full rounded-full bg-primary-gradient text-sm font-bold text-white shadow-payment-active disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "กำลังบันทึก..." : "บันทึกทุกวันและทุกช่วงเวลา"}
        </button>
      </form>
    </section>
  );
}
