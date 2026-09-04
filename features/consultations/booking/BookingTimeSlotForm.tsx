"use client";

import { useMemo, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { createConsultationBookingAction } from "@/features/consultations/booking/actions";
import type { BookingSlot, DoctorBookingData } from "@/features/consultations/booking/types";
import { BookingIdentityVerification } from "@/features/identity-verification/BookingIdentityVerification";
import type { PatientVerificationStatus } from "@/features/identity-verification/service";

const staticTimeSlots = ["09:00", "09:15", "09:30", "09:45", "10:00", "10:15"];

function getDayNumber(dateLabel: string): string {
  return dateLabel.match(/\d+/)?.[0] ?? dateLabel;
}

function getStaticSlot(slot: string): BookingSlot {
  return {
    id: `static-${slot}`,
    slotKey: `static-${slot}`,
    weekdayLabel: "ตัวอย่าง",
    dateLabel: "10 มิ.ย.",
    timeLabel: slot,
    slotMinutes: 15,
    scheduledAt: "",
    notes: "static",
    status: "available",
    statusLabel: "ว่าง"
  };
}

export function BookingTimeSlotForm({ data, verification, bookingError }: { data: DoctorBookingData; verification: PatientVerificationStatus; bookingError: string | null }) {
  const slots = useMemo(() => (data.slots.length > 0 ? data.slots : staticTimeSlots.map(getStaticSlot)), [data.slots]);
  const hasRealSlots = data.slots.length > 0 && !data.unavailable;
  const firstAvailableSlot = slots.find((slot) => slot.status === "available");
  const hasBookableSlots = hasRealSlots && Boolean(firstAvailableSlot);
  const [selectedDate, setSelectedDate] = useState(firstAvailableSlot?.dateLabel ?? slots[0]?.dateLabel ?? "");
  const [selectedSlotKey, setSelectedSlotKey] = useState(firstAvailableSlot?.slotKey ?? "");
  const selectedSlot = slots.find((slot) => slot.slotKey === selectedSlotKey);

  const availableDates = useMemo(() => Array.from(new Set(slots.map((slot) => slot.dateLabel))), [slots]);
  const filteredSlots = slots.filter((slot) => slot.dateLabel === selectedDate);

  function selectDate(dateLabel: string) {
    const firstSlot = slots.find((slot) => slot.dateLabel === dateLabel && slot.status === "available");
    setSelectedDate(dateLabel);
    setSelectedSlotKey(firstSlot?.slotKey ?? "");
  }

  return (
    <form action={createConsultationBookingAction} className="space-y-6">
      <CalendarPicker dates={availableDates} selectedDate={selectedDate} onSelectDate={selectDate} enabled={hasRealSlots} />

      <section className="flex flex-col gap-5">
        <div className="flex items-end justify-between px-1">
          <h2 className="text-lg font-bold leading-7 text-primary">เลือกเวลาปรึกษา</h2>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-[#3e494a]">อัตราค่าบริการ</p>
            <p className="whitespace-nowrap text-sm leading-5 text-[#3e494a]">
              <span className="text-lg font-bold leading-7 text-primary">{data.doctor?.fee ?? "800 บาท"}</span> / slot
            </p>
          </div>
        </div>

        {data.unavailable ? (
          <p className="rounded-[16px] border border-[#ba1a1a]/20 bg-white/70 px-4 py-3 text-sm font-semibold leading-6 text-[#93000a]">
            ไม่สามารถโหลดเวลาว่างจากฐานข้อมูลได้
          </p>
        ) : null}

        {!data.unavailable && data.doctor && data.slots.length === 0 ? (
          <p className="rounded-[16px] border border-[#bdc9ca]/30 bg-white/70 px-4 py-3 text-sm font-semibold leading-6 text-[#3e494a]">
            แพทย์ยังไม่ได้เปิดเวลาว่าง กรุณากลับมาตรวจสอบอีกครั้ง
          </p>
        ) : null}

        {bookingError ? (
          <p className="rounded-[16px] border border-[#ba1a1a]/20 bg-white/70 px-4 py-3 text-sm font-semibold leading-6 text-[#93000a]">
            {bookingError}
          </p>
        ) : null}

        {!verification.isVerified ? <BookingIdentityVerification status={verification} /> : null}

        <input type="hidden" name="availabilityId" value={hasRealSlots ? selectedSlot?.id ?? "" : ""} />
        <input type="hidden" name="scheduledAt" value={hasRealSlots ? selectedSlot?.scheduledAt ?? "" : ""} />
        <input type="hidden" name="doctorId" value={data.doctor?.id ?? ""} />

        <div className="grid grid-cols-2 gap-3">
          {filteredSlots.map((slot) => {
            const isSelected = selectedSlotKey === slot.slotKey && hasRealSlots;
            const isBooked = slot.status === "booked";

            return (
              <button
                key={slot.slotKey}
                data-testid="booking-slot-button"
                type="button"
                disabled={!hasRealSlots || isBooked}
                onClick={() => setSelectedSlotKey(slot.slotKey)}
                aria-pressed={isSelected}
                className={
                  isSelected
                  ? "flex min-h-[72px] flex-col justify-center rounded-lg bg-[#007b83] px-3 py-2 text-left text-white shadow-selected-slot ring-2 ring-white"
                    : isBooked
                      ? "flex min-h-[72px] flex-col justify-center rounded-lg bg-[#eceff1] px-3 py-2 text-left text-[#7b8586] opacity-75"
                      : "flex min-h-[72px] flex-col justify-center rounded-lg bg-[#f2f4f6] px-3 py-2 text-left text-[#3e494a] disabled:cursor-not-allowed disabled:opacity-50"
                }
              >
                <span className="text-xs font-bold">
                  {slot.weekdayLabel} {slot.dateLabel}
                </span>
                <span className="mt-1 text-sm font-extrabold">{slot.timeLabel}</span>
                {isBooked ? <span className="mt-1 text-[10px] font-semibold opacity-80">{slot.statusLabel}</span> : null}
                <span className="mt-1 text-[10px] font-semibold opacity-80">{slot.slotMinutes} นาที</span>
              </button>
            );
          })}
        </div>

        <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-sheet mx-auto w-full max-w-[480px] px-4">
          <button
            type="submit"
            disabled={!hasBookableSlots || !selectedSlot || !verification.isVerified}
            className="flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-primary-gradient text-base font-bold leading-6 text-white shadow-booking disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarCheck aria-hidden="true" className="size-5" strokeWidth={2.2} />
            {verification.isVerified ? "ยืนยันการจอง" : "ยืนยันข้อมูลเพื่อจอง"}
          </button>
        </div>
      </section>
    </form>
  );
}

function CalendarPicker({
  dates,
  selectedDate,
  onSelectDate,
  enabled
}: {
  dates: string[];
  selectedDate: string;
  onSelectDate: (dateLabel: string) => void;
  enabled: boolean;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold leading-7 text-primary">ปฏิทินการนัดหมาย</h2>
        <p className="text-base leading-6 text-[#3e494a]">เลือกจากเวลาที่เปิดไว้</p>
      </div>

      <div className="rounded-[24px] border border-[#bdc9ca]/15 bg-white/70 p-[21px] backdrop-blur-topbar">
        <div className="grid grid-cols-4 gap-3">
          {dates.map((dateLabel) => {
            const isSelected = selectedDate === dateLabel && enabled;

            return (
              <button
                key={dateLabel}
                type="button"
                disabled={!enabled}
                onClick={() => onSelectDate(dateLabel)}
                aria-pressed={isSelected}
                className={
                  isSelected
                    ? "flex size-16 flex-col items-center justify-center rounded-full bg-primary p-0 font-bold text-white shadow-selected-date"
                    : "flex size-16 flex-col items-center justify-center rounded-full bg-white/60 p-0 font-bold text-[#3e494a] disabled:cursor-not-allowed disabled:opacity-50"
                }
              >
                <span className="text-base leading-none">{getDayNumber(dateLabel)}</span>
                <span className="mt-1 text-xs leading-none opacity-85">{dateLabel.replace(getDayNumber(dateLabel), "").trim()}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
