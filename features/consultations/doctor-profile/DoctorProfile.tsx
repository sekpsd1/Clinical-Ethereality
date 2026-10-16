import type { Route } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DoctorAvatar } from "@/features/consultations/DoctorAvatar";
import { getCustomerDoctorDisplayName } from "@/features/consultations/doctor-display-name";
import { NEW_CONSULTATION_DURATION_MINUTES } from "@/features/consultations/duration-policy";
import type { getCustomerDoctorProfile } from "./queries";

type DoctorProfileRecord = NonNullable<Awaited<ReturnType<typeof getCustomerDoctorProfile>>>;

export function DoctorProfile({ doctor, bookingHref }: { doctor: DoctorProfileRecord; bookingHref: Route }) {
  const name = getCustomerDoctorDisplayName(doctor.user);
  return (
    <section className="flex flex-col gap-4 py-4">
      <Link href="/consult" className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-primary">
        <ArrowLeft aria-hidden="true" className="size-5" /> กลับไปเลือกแพทย์
      </Link>
      <h1 className="text-center text-lg font-bold text-primary">ประวัติแพทย์</h1>
      <article className="rounded-[24px] border border-white/40 bg-white/70 p-5 shadow-bio-card backdrop-blur-card">
        <div className="mx-auto relative size-24 overflow-hidden rounded-full">
          <DoctorAvatar src={doctor.user.avatarUrl} alt={name} />
        </div>
        <h2 className="mt-3 break-words text-center text-xl font-bold text-primary">{name}</h2>
        <p className="mt-2 break-words text-center text-sm text-text">{doctor.specialty || "ปรึกษาออนไลน์"}</p>
        <p className="mt-3 break-words text-sm">เลขใบประกอบวิชาชีพ: {doctor.licenseNumber || "ยังไม่ระบุ"}</p>
        <h3 className="mt-5 font-bold text-primary">ประวัติ / คำแนะนำแพทย์</h3>
        <p className="mt-2 whitespace-pre-line break-words text-sm leading-7 [overflow-wrap:anywhere]">
          {doctor.bio?.trim() || "ยังไม่มีข้อมูลประวัติแพทย์"}
        </p>
        <h3 className="mt-5 font-bold text-primary">ค่าปรึกษาและเวลานัด</h3>
        <p className="mt-2 text-sm leading-6">
          {doctor.consultationFee === null ? "ยังไม่ระบุค่าปรึกษา" : `${new Intl.NumberFormat("th-TH").format(doctor.consultationFee)} บาท / ${NEW_CONSULTATION_DURATION_MINUTES} นาที`}
        </p>
        <p className="mt-1 text-sm leading-6">ตรวจสอบวันและเวลาว่างล่าสุดในหน้าจองคำปรึกษา</p>
      </article>
      <Link href={bookingHref} className="flex min-h-12 items-center justify-center rounded-full bg-primary-gradient px-4 text-sm font-bold text-white shadow-chip">
        เลือกเวลาจองคำปรึกษา
      </Link>
    </section>
  );
}
