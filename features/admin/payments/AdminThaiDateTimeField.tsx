"use client";

import { useId, useState } from "react";

export function formatThaiDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}

export function formatThaiTimeInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return [digits.slice(0, 2), digits.slice(2)].filter(Boolean).join(":");
}

export function toBangkokLocalDateTime(dateValue: string, timeValue: string): string | null {
  const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);
  if (!dateMatch || !timeMatch) return null;

  const [, dayText, monthText, yearText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1] || hour > 23 || minute > 59) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}`;
}

export function AdminThaiDateTimeField({
  label,
  name,
  disabled = false
}: {
  label: string;
  name: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [dateValue, setDateValue] = useState("");
  const [timeValue, setTimeValue] = useState("");
  const transferValue = toBangkokLocalDateTime(dateValue, timeValue) ?? "";

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-1">
      <legend className="text-xs font-bold text-muted">{label} (ประเทศไทย)</legend>
      <div className="grid grid-cols-2 gap-2">
        <label htmlFor={`${id}-date`} className="min-w-0 text-xs font-medium text-muted">
          วันที่ (ค.ศ.)
          <input
            id={`${id}-date`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            required
            pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
            placeholder="DD/MM/YYYY"
            aria-label={`${label} วันที่ DD/MM/YYYY (ค.ศ.)`}
            value={dateValue}
            onChange={(event) => {
              const nextDate = formatThaiDateInput(event.target.value);
              setDateValue(nextDate);
              event.target.setCustomValidity(
                nextDate.length === 10 && !toBangkokLocalDateTime(nextDate, "00:00")
                  ? "กรุณาระบุวันที่จริงในรูปแบบ DD/MM/YYYY (ค.ศ.)"
                  : ""
              );
            }}
            className="mt-1 h-11 w-full min-w-0 rounded-[8px] border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary"
          />
        </label>
        <label htmlFor={`${id}-time`} className="min-w-0 text-xs font-medium text-muted">
          เวลา 24 ชั่วโมง
          <input
            id={`${id}-time`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            required
            pattern="[0-9]{2}:[0-9]{2}"
            placeholder="HH:mm"
            aria-label={`${label} เวลา HH:mm (00:00–23:59)`}
            value={timeValue}
            onChange={(event) => {
              const nextTime = formatThaiTimeInput(event.target.value);
              setTimeValue(nextTime);
              event.target.setCustomValidity(
                nextTime.length === 5 && !toBangkokLocalDateTime("01/01/2026", nextTime)
                  ? "กรุณาระบุเวลา 00:00–23:59"
                  : ""
              );
            }}
            className="mt-1 h-11 w-full min-w-0 rounded-[8px] border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary"
          />
        </label>
      </div>
      <input type="hidden" name={name} value={transferValue} />
    </fieldset>
  );
}
