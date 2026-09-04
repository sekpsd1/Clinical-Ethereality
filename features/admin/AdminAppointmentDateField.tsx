"use client";

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

function formatDayMonthYear(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "เลือกวัน/เดือน/ปี";
}

export function AdminAppointmentDateField({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    inputRef.current?.showPicker();
  }

  return (
    <label className="text-xs font-bold text-text">
      วันที่
      <input ref={inputRef} name="date" type="date" value={value} onChange={(event) => setValue(event.target.value)} className="sr-only" tabIndex={-1} />
      <button type="button" onClick={openPicker} className="mt-1 flex h-10 w-full items-center justify-between rounded-[8px] border border-border bg-white px-3 text-left text-sm font-semibold text-text" aria-label="เลือกวัน เดือน ปี">
        <span>{formatDayMonthYear(value)}</span>
        <CalendarDays aria-hidden="true" className="size-4 text-primary" />
      </button>
    </label>
  );
}
