"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AdminDoctorAvailabilityDateOverride, AdminDoctorAvailabilitySlot } from "@/features/admin/schedules/types";

const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function toDateValue(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isEffectiveOn(slot: AdminDoctorAvailabilitySlot, dateValue: string) {
  return (!slot.effectiveFromValue || dateValue >= slot.effectiveFromValue) && (!slot.effectiveToValue || dateValue <= slot.effectiveToValue);
}

export function AdminDateScheduleCalendar({ overrides, slots }: { overrides: AdminDoctorAvailabilityDateOverride[]; slots: AdminDoctorAvailabilitySlot[] }) {
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const days = useMemo(() => {
    const start = month.getDay();
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: start + last }, (_, index) => (index < start ? null : index - start + 1));
  }, [month]);
  const selectedOverrides = selectedDate ? overrides.filter((item) => item.scheduleDateValue === selectedDate && item.isActive) : [];
  const selectedDateObject = selectedDate ? new Date(`${selectedDate}T00:00:00`) : null;
  const selectedIsClosed = selectedOverrides.some((item) => item.type === "closed");
  const selectedRegular = selectedDateObject && selectedDate && !selectedIsClosed ? slots.filter((slot) => slot.isActive && slot.weekday === selectedDateObject.getDay() && isEffectiveOn(slot, selectedDate)) : [];

  return (
    <section className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">ปฏิทิน</p><h2 className="mt-1 font-headline text-lg font-bold text-text">ตารางพิเศษตามวันที่</h2></div><div className="flex items-center gap-1"><button type="button" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="rounded-[8px] p-2 text-primary"><ChevronLeft className="size-4" /></button><button type="button" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="rounded-[8px] p-2 text-primary"><ChevronRight className="size-4" /></button></div></div>
      <p className="mt-2 text-sm font-bold text-text">{new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(month)}</p>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">{days.map((day, index) => {
        if (!day) return <span key={`blank-${index}`} />;
        const dateValue = toDateValue(month.getFullYear(), month.getMonth(), day);
        const items = overrides.filter((item) => item.scheduleDateValue === dateValue && item.isActive);
        const date = new Date(month.getFullYear(), month.getMonth(), day);
        const regular = slots.filter((slot) => slot.isActive && slot.weekday === date.getDay() && isEffectiveOn(slot, dateValue));
        const hasClosed = items.some((item) => item.type === "closed");
        const hasSpecial = items.some((item) => item.type === "available");
        const hasRegular = !hasClosed && regular.length > 0;
        return <button key={dateValue} type="button" onClick={() => setSelectedDate(dateValue)} className={`min-h-12 rounded-[8px] border p-1 text-xs font-bold ${selectedDate === dateValue ? "border-primary bg-primary/10 text-primary" : "border-border bg-white text-text"}`}><span>{day}</span>{hasClosed || hasSpecial || hasRegular ? <span className={`mx-auto mt-1 block h-1.5 w-1.5 rounded-full ${hasClosed ? "bg-[#ba1a1a]" : hasSpecial ? "bg-primary" : "bg-[#2e8b8b]"}`} /> : null}</button>;
      })}</div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-muted"><span>● สีฟ้า: เวลาว่างประจำ</span><span className="text-primary">● สีเขียว: เวลาพิเศษ</span><span className="text-[#ba1a1a]">● สีแดง: วันหยุด</span></div>
      {selectedDate ? <div className="mt-4 rounded-[8px] bg-primary/5 p-3 text-xs"><p className="font-bold text-text">{new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(selectedDateObject!)}</p>{selectedOverrides.map((item) => <p key={item.id} className={`mt-1 font-semibold ${item.type === "closed" ? "text-[#93000a]" : "text-primary"}`}>{item.doctorName}: {item.type === "closed" ? "วันหยุด" : `เวลาพิเศษ ${item.timeRange}`}</p>)}{selectedRegular.map((slot) => <p key={slot.id} className="mt-1 font-semibold text-[#2e8b8b]">{slot.doctorName}: เวลาว่างประจำ {slot.timeRange}</p>)}{selectedOverrides.length === 0 && selectedRegular.length === 0 ? <p className="mt-1 text-muted">ไม่มีเวลาว่าง</p> : null}</div> : <p className="mt-3 text-xs text-muted">เลือกวันที่เพื่อดูเวลาว่างและตารางพิเศษ</p>}
    </section>
  );
}
