"use client";

import Link from "next/link";
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

function getBangkokDateValue(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export function AdminDateScheduleCalendar({
  overrides,
  slots,
  selectedDate,
  selectedDoctorId
}: {
  overrides: AdminDoctorAvailabilityDateOverride[];
  slots: AdminDoctorAvailabilitySlot[];
  selectedDate: string;
  selectedDoctorId: string;
}) {
  const today = new Date();
  const [month, setMonth] = useState(() => {
    const selected = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? new Date(`${selectedDate}T00:00:00.000Z`) : today;
    return new Date(selected.getUTCFullYear(), selected.getUTCMonth(), 1);
  });
  const todayDate = getBangkokDateValue(today);
  const days = useMemo(() => {
    const start = month.getDay();
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: start + last }, (_, index) => (index < start ? null : index - start + 1));
  }, [month]);
  const selectedOverrides = overrides.filter((item) => item.scheduleDateValue === selectedDate && item.isActive);
  const selectedDateObject = new Date(`${selectedDate}T00:00:00.000Z`);
  const selectedIsClosed = selectedOverrides.some((item) => item.type === "closed");
  const selectedRegular = !selectedIsClosed ? slots.filter((slot) => slot.isActive && slot.weekday === selectedDateObject.getUTCDay() && isEffectiveOn(slot, selectedDate)) : [];

  return (
    <section className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">ขั้นตอนที่ 1</p><h2 className="mt-1 font-headline text-lg font-bold text-text">เลือกวันที่จากปฏิทิน</h2><p className="mt-1 text-xs leading-5 text-muted">เลือกวันก่อน แล้วระบบจะแสดงตารางแพทย์ของวันนั้นด้านล่าง</p></div><div className="flex items-center gap-1"><button type="button" aria-label="เดือนก่อนหน้า" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="rounded-[8px] p-2 text-primary"><ChevronLeft className="size-4" /></button><button type="button" aria-label="เดือนถัดไป" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="rounded-[8px] p-2 text-primary"><ChevronRight className="size-4" /></button></div></div>
      <p className="mt-2 text-sm font-bold text-text">{new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(month)}</p>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">{days.map((day, index) => {
        if (!day) return <span key={`blank-${index}`} />;
        const dateValue = toDateValue(month.getFullYear(), month.getMonth(), day);
        const items = overrides.filter((item) => item.scheduleDateValue === dateValue && item.isActive);
        const date = new Date(`${dateValue}T00:00:00.000Z`);
        const regular = slots.filter((slot) => slot.isActive && slot.weekday === date.getUTCDay() && isEffectiveOn(slot, dateValue));
        const hasClosed = items.some((item) => item.type === "closed");
        const hasSpecial = items.some((item) => item.type === "available");
        const hasRegular = !hasClosed && regular.length > 0;
        const className = `min-h-12 rounded-[8px] border p-1 text-xs font-bold ${selectedDate === dateValue ? "border-primary bg-primary/10 text-primary" : "border-border bg-white text-text"}`;
        const marker = hasClosed || hasSpecial || hasRegular ? <span className={`mx-auto mt-1 block h-1.5 w-1.5 rounded-full ${hasClosed ? "bg-[#ba1a1a]" : hasSpecial ? "bg-primary" : "bg-[#2e8b8b]"}`} /> : null;
        if (dateValue < todayDate) return <span key={dateValue} aria-label={`${day} วันย้อนหลัง`} className={`${className} cursor-not-allowed opacity-40`}><span>{day}</span>{marker}</span>;
        const href = { pathname: "/admin/schedules", query: selectedDoctorId ? { date: dateValue, doctor: selectedDoctorId } : { date: dateValue }, hash: "doctor-schedule" };
        return <Link key={dateValue} href={href} className={className}><span>{day}</span>{marker}</Link>;
      })}</div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-muted"><span>● สีฟ้า: เวลาว่างประจำ</span><span className="text-primary">● สีเขียว: เวลาพิเศษ</span><span className="text-[#ba1a1a]">● สีแดง: วันหยุด</span></div>
      <div className="mt-4 rounded-[8px] bg-primary/5 p-3 text-xs"><p className="font-bold text-text">วันที่เลือก: {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "UTC" }).format(selectedDateObject)}</p>{selectedOverrides.map((item) => <p key={item.id} className={`mt-1 font-semibold ${item.type === "closed" ? "text-[#93000a]" : "text-primary"}`}>{item.doctorName}: {item.type === "closed" ? "วันหยุด" : `เวลาพิเศษ ${item.timeRange}`}</p>)}{selectedRegular.map((slot) => <p key={slot.id} className="mt-1 font-semibold text-[#2e8b8b]">{slot.doctorName}: เวลาว่างประจำ {slot.timeRange}</p>)}{selectedOverrides.length === 0 && selectedRegular.length === 0 ? <p className="mt-1 text-muted">ยังไม่มีเวลาตรวจที่เปิดไว้</p> : null}</div>
    </section>
  );
}
