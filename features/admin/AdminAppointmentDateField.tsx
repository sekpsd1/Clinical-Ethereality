"use client";

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

function formatDayMonthYear(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "เลือกวัน/เดือน/ปี";
}

export function AdminDayMonthYearDateField({
  initialValue,
  name = "date",
  label = "วันที่",
  disabled = false,
  required = false,
  onValueChange
}: {
  initialValue: string;
  name?: string;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    inputRef.current?.showPicker();
  }

  return (
    <label className="text-xs font-bold text-text">
      {label}
      <input ref={inputRef} name={name} type="date" value={value} onChange={(event) => { setValue(event.target.value); onValueChange?.(event.target.value); }} className="sr-only" tabIndex={-1} disabled={disabled} required={required} />
      <button type="button" onClick={openPicker} disabled={disabled} className="mt-1 flex h-10 w-full items-center justify-between rounded-[8px] border border-border bg-white px-3 text-left text-sm font-semibold text-text disabled:opacity-50" aria-label="เลือกวัน เดือน ปี">
        <span>{formatDayMonthYear(value)}</span>
        <CalendarDays aria-hidden="true" className="size-4 text-primary" />
      </button>
    </label>
  );
}

export function AdminAppointmentDateField({ initialValue }: { initialValue: string }) {
  return <AdminDayMonthYearDateField initialValue={initialValue} />;
}
