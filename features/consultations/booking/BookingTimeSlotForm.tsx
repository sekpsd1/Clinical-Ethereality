"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CalendarCheck } from "lucide-react";
import {
  createConsultationBookingAction,
  reschedulePaidConsultationAction
} from "@/features/consultations/booking/actions";
import type { BookingSlot, DoctorBookingData } from "@/features/consultations/booking/types";
import { BookingIdentityVerification } from "@/features/identity-verification/BookingIdentityVerification";
import type { PatientVerificationStatus } from "@/features/identity-verification/service";
import { TELEMEDICINE_CONSENT_VERSION } from "@/features/consultations/consent/policy";
import { NEW_CONSULTATION_DURATION_MINUTES } from "@/features/consultations/duration-policy";
import { TelemedicineConsentContent } from "@/features/consultations/consent/TelemedicineConsentContent";
import { telemedicineConsentFinalChoices } from "@/features/consultations/consent/content";

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
    slotMinutes: NEW_CONSULTATION_DURATION_MINUTES,
    scheduledAt: "",
    notes: "static",
    status: "available",
    statusLabel: "ว่าง"
  };
}

export function BookingTimeSlotForm({ data, verification, canSelfConsent, bookingError, rescheduleConsultationId }: { data: DoctorBookingData; verification: PatientVerificationStatus; canSelfConsent: boolean; bookingError: string | null; rescheduleConsultationId?: string }) {
  const slots = useMemo(() => (data.slots.length > 0 ? data.slots : staticTimeSlots.map(getStaticSlot)), [data.slots]);
  const hasRealSlots = data.slots.length > 0 && !data.unavailable;
  const firstAvailableSlot = slots.find((slot) => slot.status === "available");
  const hasBookableSlots = hasRealSlots && Boolean(firstAvailableSlot);
  const [selectedDate, setSelectedDate] = useState(firstAvailableSlot?.dateLabel ?? slots[0]?.dateLabel ?? "");
  const [selectedSlotKey, setSelectedSlotKey] = useState(firstAvailableSlot?.slotKey ?? "");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const selectedSlot = slots.find((slot) => slot.slotKey === selectedSlotKey);

  const availableDates = useMemo(() => Array.from(new Set(slots.map((slot) => slot.dateLabel))), [slots]);
  const filteredSlots = slots.filter((slot) => slot.dateLabel === selectedDate);
  const isAdult = canSelfConsent;
  const requiresNewConsent = !rescheduleConsultationId;

  function selectDate(dateLabel: string) {
    const firstSlot = slots.find((slot) => slot.dateLabel === dateLabel && slot.status === "available");
    setSelectedDate(dateLabel);
    setSelectedSlotKey(firstSlot?.slotKey ?? "");
  }

  return (
    <form action={rescheduleConsultationId ? reschedulePaidConsultationAction : createConsultationBookingAction} className="space-y-6">
      {rescheduleConsultationId ? <input type="hidden" name="consultationId" value={rescheduleConsultationId} /> : null}
      {rescheduleConsultationId ? (
        <p className="rounded-[16px] border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold leading-6 text-primary">
          การชำระเงินยืนยันแล้ว เลือกเวลาใหม่กับแพทย์เดิมโดยไม่ต้องชำระซ้ำ
        </p>
      ) : null}
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

        {requiresNewConsent && verification.isVerified ? (
          isAdult ? (
            <div className="space-y-3">
              <section className="rounded-[20px] border border-primary/25 bg-white/80 p-4 shadow-sm" aria-labelledby="booking-telemedicine-consent-title">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold leading-5 text-[#616363]">
                  <p id="booking-telemedicine-consent-instructions">เลื่อนภายในกรอบเพื่ออ่านเนื้อหาทั้งหมด</p>
                  <Link
                    href={"/telemedicine-consent" as Route}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-primary underline underline-offset-4"
                  >
                    เปิดหน้าเอกสารเต็ม
                  </Link>
                </div>
                <div
                  role="region"
                  tabIndex={0}
                  aria-labelledby="booking-telemedicine-consent-title"
                  aria-describedby="booking-telemedicine-consent-instructions"
                  className="max-h-[22rem] overflow-y-scroll overscroll-contain rounded-[14px] border border-[#bdc9ca]/50 bg-white px-4 py-4 pr-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <TelemedicineConsentContent titleId="booking-telemedicine-consent-title" />
                </div>
                <p className="mt-3 text-xs font-semibold leading-5 text-[#616363]" aria-hidden="true">
                  พื้นที่ข้อความด้านบนเลื่อนอ่านได้
                </p>
              </section>

              <label className="flex gap-3 rounded-[20px] border border-primary/20 bg-white/75 p-4 text-sm leading-6 text-[#3e494a] shadow-sm">
                <input
                  type="checkbox"
                  name="telemedicineConsentAccepted"
                  required
                  checked={consentAccepted}
                  onChange={(event) => setConsentAccepted(event.target.checked)}
                  className="mt-1 size-5 shrink-0 accent-primary"
                />
                <span>
                  ข้าพเจ้าได้อ่านและเข้าใจข้อความข้างต้น ฉบับ {TELEMEDICINE_CONSENT_VERSION} และเลือก “{telemedicineConsentFinalChoices[0]}” สำหรับการจองนี้
                </span>
              </label>
            </div>
          ) : (
            <p className="rounded-[20px] border border-danger/20 bg-danger/5 p-4 text-sm font-semibold leading-6 text-danger">
              ผู้มีอายุต่ำกว่า 18 ปีไม่สามารถให้ความยินยอมเองได้ การจองต้องได้รับความยินยอมจากผู้ปกครองตามกฎหมาย กรุณาติดต่อแอดมินก่อนดำเนินการ
            </p>
          )
        ) : null}

        <input type="hidden" name="availabilityId" value={hasRealSlots ? selectedSlot?.id ?? "" : ""} />
        <input type="hidden" name="scheduledAt" value={hasRealSlots ? selectedSlot?.scheduledAt ?? "" : ""} />
        <input type="hidden" name="doctorId" value={data.doctor?.id ?? ""} />
        {requiresNewConsent ? <input type="hidden" name="telemedicineConsentVersion" value={TELEMEDICINE_CONSENT_VERSION} /> : null}

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
                <span className="mt-1 text-[10px] font-semibold opacity-80">{NEW_CONSULTATION_DURATION_MINUTES} นาที</span>
              </button>
            );
          })}
        </div>

        <div
          data-testid="booking-submit-bar"
          className="mt-2 w-full py-2"
        >
          <button
            type="submit"
            disabled={!hasBookableSlots || !selectedSlot || !verification.isVerified || (requiresNewConsent && (!isAdult || !consentAccepted))}
            className="flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-primary-gradient text-base font-bold leading-6 text-white shadow-booking disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarCheck aria-hidden="true" className="size-5" strokeWidth={2.2} />
            {verification.isVerified ? (rescheduleConsultationId ? "ยืนยันเวลาใหม่" : "ยืนยันการจอง") : "ยืนยันข้อมูลเพื่อจอง"}
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
