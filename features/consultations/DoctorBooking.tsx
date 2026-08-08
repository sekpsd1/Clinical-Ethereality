import Link from "next/link";
import { ArrowLeft, Bell, HeartPulse, Star } from "lucide-react";
import { BookingTimeSlotForm } from "@/features/consultations/booking/BookingTimeSlotForm";
import { DoctorAvatar } from "@/features/consultations/DoctorAvatar";
import type { DoctorBookingData } from "@/features/consultations/booking/types";

export function DoctorBooking({ data, bookingStatus }: { data: DoctorBookingData; bookingStatus?: string }) {
  const bookingError =
    bookingStatus === "failed"
      ? "ไม่สามารถจองเวลานี้ได้ อาจมีผู้จองแล้วหรือ slot ถูกปิด กรุณาเลือกเวลาอื่น"
      : bookingStatus === "locked"
        ? "เวลานี้ถูกจองแล้ว กรุณาเลือกเวลาปรึกษาอื่น"
        : bookingStatus === "invalid"
        ? "กรุณาเลือกเวลานัดหมายก่อนยืนยัน"
        : null;

  return (
    <section className="-mx-4 min-h-dvh bg-app pb-[calc(11rem+env(safe-area-inset-bottom))]">
      <BookingTopBar />

      <div className="flex flex-col gap-6 px-4 pt-[72px]">
        <DoctorBioCard doctor={data.doctor} />
        <BookingTimeSlotForm data={data} bookingError={bookingError} />
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
  const doctorName = doctor?.name ?? "พญ. กมลภัทร วิจักขณ์พันธ์";

  return (
    <article className="relative h-[260px] rounded-[24px] border border-[#bdc9ca]/15 bg-white/70 shadow-bio-card backdrop-blur-topbar">
      <div className="absolute left-1/2 top-6 -translate-x-1/2">
        <div className="relative size-24 rounded-full border-4 border-white p-1 shadow-avatar">
          <div className="relative size-full overflow-hidden rounded-full">
            <DoctorAvatar src={doctor?.avatarUrl} alt={doctorName} />
          </div>
          <div className="absolute bottom-0 right-0 flex size-7 items-center justify-center rounded-full border-2 border-white bg-[#007b83] text-white">
            <HeartPulse aria-hidden="true" className="size-3.5" strokeWidth={2.4} />
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 top-[124px] flex flex-col items-center gap-1 px-5 text-center">
        <h2 className="text-xl font-bold leading-7 tracking-normal text-primary">{doctorName}</h2>
        <div className="flex min-h-6 items-center justify-center gap-1 rounded-full bg-white/70 px-3 text-sm font-medium leading-5 text-[#3e494a] shadow-sm">
          <Star aria-hidden="true" className="size-[15px] fill-[#f2b705] text-[#f2b705]" />
          <span>4.9 (120+ รีวิว)</span>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-6 flex flex-wrap justify-center gap-2 px-5">
        <span className="rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold leading-[18px] tracking-normal text-primary">
          {doctor?.specialty ?? "สูตินรีเวช"}
        </span>
        <span className="rounded-full bg-[#dfe0e0]/50 px-4 py-1.5 text-xs font-bold leading-[18px] tracking-normal text-[#616363]">
          ปรึกษาออนไลน์
        </span>
      </div>
    </article>
  );
}
