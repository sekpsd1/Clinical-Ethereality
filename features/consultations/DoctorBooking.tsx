import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Bell, CalendarCheck, HeartPulse, Star } from "lucide-react";
import { createConsultationBookingAction } from "@/features/consultations/booking/actions";
import type { BookingSlot, DoctorBookingData } from "@/features/consultations/booking/types";

const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const calendarDays = [null, null, null, "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "..."];

const timeSlots = ["09:00", "09:15", "09:30", "09:45", "10:00", "10:15"];

export function DoctorBooking({ data, bookingStatus }: { data: DoctorBookingData; bookingStatus?: string }) {
  const bookingError =
    bookingStatus === "failed"
      ? "ไม่สามารถจองเวลานี้ได้ อาจมีผู้จองแล้วหรือ slot ถูกปิด กรุณาเลือกเวลาอื่น"
      : bookingStatus === "invalid"
        ? "กรุณาเลือกเวลานัดหมายก่อนยืนยัน"
        : null;

  return (
    <section className="-mx-4 min-h-dvh bg-app pb-[calc(11rem+env(safe-area-inset-bottom))]">
      <BookingTopBar />

      <div className="flex flex-col gap-8 px-6 pt-20">
        <DoctorBioCard doctor={data.doctor} />
        <CalendarSection />
        <TimeSlotSection data={data} bookingError={bookingError} />
      </div>
    </section>
  );
}

function BookingTopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-header mx-auto flex h-16 max-w-[480px] items-center justify-between bg-white/70 px-7 shadow-booking-top backdrop-blur-topbar">
      <Link href="/consult" aria-label="Back to doctors" className="flex size-10 items-center justify-start text-primary">
        <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.25} />
      </Link>
      <h1 className="text-lg font-bold leading-7 tracking-normal text-primary">ข้อมูลแพทย์</h1>
      <button type="button" aria-label="Notifications" className="flex size-10 items-center justify-end text-primary">
        <Bell aria-hidden="true" className="size-5" strokeWidth={2.25} />
      </button>
    </header>
  );
}

function DoctorBioCard({ doctor }: { doctor: DoctorBookingData["doctor"] }) {
  return (
    <article className="relative h-[260px] rounded-[24px] border border-[#bdc9ca]/15 bg-white/70 shadow-bio-card backdrop-blur-topbar">
      <div className="absolute left-1/2 top-6 -translate-x-1/2">
        <div className="relative size-24 rounded-full border-4 border-white p-1 shadow-avatar">
          <div className="relative size-full overflow-hidden rounded-full">
            <Image
              src="/images/doctors/somchai-portrait.png"
              alt={doctor?.name ?? "นพ. สมชาย รัตนวงศาล"}
              fill
              sizes="96px"
              className="object-cover"
            />
          </div>
          <div className="absolute bottom-0 right-0 flex size-7 items-center justify-center rounded-full border-2 border-white bg-[#007b83] text-white">
            <HeartPulse aria-hidden="true" className="size-3.5" strokeWidth={2.4} />
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 top-[136px] flex flex-col items-center gap-1 px-5 text-center">
        <h2 className="text-xl font-bold leading-7 tracking-normal text-primary">{doctor?.name ?? "นพ. สมชาย รัตนวงศาล"}</h2>
        <div className="flex items-center justify-center gap-1 text-sm font-medium leading-5 text-[#3e494a]">
          <Star aria-hidden="true" className="size-[15px] fill-[#f2b705] text-[#f2b705]" />
          <span>4.9 (120+ รีวิว)</span>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-8 flex justify-center gap-2 px-5">
        <span className="rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold leading-[18px] tracking-normal text-primary">
          {doctor?.specialty ?? "เวชศาสตร์ชะลอวัย"}
        </span>
        <span className="rounded-full bg-[#dfe0e0]/50 px-4 py-1.5 text-xs font-bold leading-[18px] tracking-normal text-[#616363]">
          ปรึกษาออนไลน์
        </span>
      </div>
    </article>
  );
}

function CalendarSection() {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold leading-7 text-primary">ปฏิทินการนัดหมาย</h2>
        <p className="text-base leading-6 text-[#3e494a]">เลือกจากเวลาที่เปิดไว้</p>
      </div>

      <div className="rounded-[24px] border border-[#bdc9ca]/15 bg-white/70 p-[21px] backdrop-blur-topbar">
        <div className="grid grid-cols-7 gap-1">
          {weekdays.map((day, index) => (
            <div
              key={day}
              className={
                index === 0
                  ? "text-center text-[11px] font-bold leading-[16.5px] text-[#ba1a1a]/60"
                  : index === 6
                    ? "text-center text-[11px] font-bold leading-[16.5px] text-primary/60"
                    : "text-center text-[11px] font-bold leading-[16.5px] text-[#3e494a]/60"
              }
            >
              {day}
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-7 gap-2">
          {calendarDays.map((day, index) => (
            <div key={`${day ?? "empty"}-${index}`} className="flex h-10 items-center justify-center">
              {day ? (
                <button
                  type="button"
                  className={
                    day === "10"
                      ? "size-10 rounded-full bg-primary text-sm font-bold leading-5 text-white shadow-selected-date"
                      : day === "..."
                        ? "size-10 text-sm leading-5 text-[#3e494a]/30"
                        : "size-10 text-sm font-medium leading-5 text-[#3e494a]"
                  }
                >
                  {day}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TimeSlotSection({ data, bookingError }: { data: DoctorBookingData; bookingError: string | null }) {
  const slots = data.slots.length > 0 ? data.slots : timeSlots.map(mapStaticSlot);
  const hasRealSlots = data.slots.length > 0 && !data.unavailable;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-end justify-between px-1">
        <h2 className="text-lg font-bold leading-7 text-primary">เลือกเวลาปรึกษา</h2>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-[#3e494a]">อัตราค่าบริการ</p>
          <p className="whitespace-nowrap text-sm leading-5 text-[#3e494a]">
            <span className="text-lg font-bold leading-7 text-primary">{data.doctor?.fee ?? "฿1,000"}</span> / slot
          </p>
        </div>
      </div>

      <form action={createConsultationBookingAction} className="space-y-5">
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

        <div className="grid grid-cols-2 gap-3">
          {slots.map((slot, index) => (
            <SlotOption key={slot.id} slot={slot} isDefault={index === 0} isEnabled={hasRealSlots} />
          ))}
        </div>

        <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-sheet mx-auto w-full max-w-[480px] px-7">
          <button
            type="submit"
            disabled={!hasRealSlots}
            className="flex h-16 w-full items-center justify-center gap-3 rounded-full bg-primary-gradient text-lg font-bold leading-7 text-white shadow-booking disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarCheck aria-hidden="true" className="size-5" strokeWidth={2.2} />
            ยืนยันการจอง
          </button>
        </div>
      </form>
    </section>
  );
}

function SlotOption({ slot, isDefault, isEnabled }: { slot: BookingSlot; isDefault: boolean; isEnabled: boolean }) {
  return (
    <label
      className={
        isDefault && isEnabled
          ? "flex min-h-[78px] cursor-pointer flex-col justify-center rounded-lg bg-[#007b83] px-3 py-2 text-white shadow-selected-slot ring-2 ring-white"
          : "flex min-h-[78px] cursor-pointer flex-col justify-center rounded-lg bg-[#f2f4f6] px-3 py-2 text-[#3e494a]"
      }
    >
      <input
        type="radio"
        name="availabilityId"
        value={slot.id}
        defaultChecked={isDefault && isEnabled}
        disabled={!isEnabled}
        className="sr-only"
      />
      <span className="text-xs font-bold">
        {slot.weekdayLabel} {slot.dateLabel}
      </span>
      <span className="mt-1 text-sm font-extrabold">{slot.timeLabel}</span>
      <span className="mt-1 text-[10px] font-semibold opacity-80">{slot.slotMinutes} นาที</span>
    </label>
  );
}

function mapStaticSlot(slot: string): BookingSlot {
  return {
    id: `static-${slot}`,
    weekdayLabel: "ตัวอย่าง",
    dateLabel: "10 พ.ค.",
    timeLabel: slot,
    slotMinutes: 15,
    scheduledAt: "",
    notes: "static"
  };
}
