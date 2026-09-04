import Link from "next/link";
import type { Route } from "next";
import {
  Camera,
  Lock,
  MonitorCheck,
  Settings,
  ShieldCheck,
  Wifi
} from "lucide-react";
import type { ConsultationWaitingRoomData } from "@/features/consultations/waiting-room/types";
import { DoctorAvatar } from "@/features/consultations/DoctorAvatar";

export function ConsultWaitingRoom({ data }: { data: ConsultationWaitingRoomData }) {
  return (
    <section className="-mx-4 min-h-dvh bg-app pb-[calc(8.25rem+env(safe-area-inset-bottom))]">
      <WaitingRoomTopBar data={data} />

      <div className="flex flex-col gap-8 px-7 pt-24">
        <HeaderSection statusMessage={data.statusMessage} />
        <CountdownCard title={data.countdownTitle} value={data.countdownValue} />
        <DoctorBrief data={data} />
        <PreparationChecklist />
        <FooterActions data={data} />
      </div>
    </section>
  );
}

function WaitingRoomTopBar({ data }: { data: ConsultationWaitingRoomData }) {
  return (
    <header className="fixed inset-x-0 top-0 z-header mx-auto flex h-[72px] max-w-[480px] items-center justify-between bg-white/70 px-7 shadow-waiting-top backdrop-blur-payment">
      <div className="flex items-center gap-3">
        <div className="relative size-10 overflow-hidden rounded-full border-2 border-[#7ad5dd] p-0.5 shadow-chip">
          <DoctorAvatar
            src={data.doctorImageUrl}
            alt={data.doctorName}
            fallbackSrc="/images/doctors/waiting-avatar.png"
          />
        </div>
        <h1 className="font-display text-xl font-bold leading-7 tracking-normal text-[#134e4a]">
          Consultation Room
        </h1>
      </div>
      <button type="button" aria-label="Settings" className="flex size-9 items-center justify-center text-[#64748b]">
        <Settings aria-hidden="true" className="size-5" strokeWidth={2.1} />
      </button>
    </header>
  );
}

function HeaderSection({ statusMessage }: { statusMessage: string }) {
  return (
    <section className="flex flex-col items-start gap-2">
      <h2 className="text-2xl font-bold leading-8 tracking-normal text-primary">ห้องนั่งรอปรึกษา</h2>
      <div className="flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-[17px] py-[9px]">
        <span className="size-2 rounded-full bg-primary" />
        <span className="text-xs font-bold leading-4 tracking-normal text-primary">{statusMessage}</span>
      </div>
    </section>
  );
}

function CountdownCard({ title, value }: { title: string; value: string }) {
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-[#bdc9ca]/15 bg-white/70 p-[33px] text-center shadow-waiting-countdown backdrop-blur-topbar">
      <p className="pb-2 text-sm font-medium uppercase leading-5 tracking-[1.4px] text-[#3e494a]">
        Appointment starts in
      </p>
      <div className="text-5xl font-bold leading-[48px] tracking-normal text-primary">
        <p>{title}</p>
        <p>{value}</p>
      </div>
      <div className="flex justify-center gap-1 pt-4">
        <span className="h-1 w-12 rounded-full bg-primary" />
        <span className="h-1 w-4 rounded-full bg-primary/20" />
        <span className="h-1 w-4 rounded-full bg-primary/20" />
      </div>
      <div className="absolute -right-24 -top-24 size-48 rounded-full bg-primary/5 blur-[32px]" />
    </section>
  );
}

function DoctorBrief({ data }: { data: ConsultationWaitingRoomData }) {
  return (
    <section className="flex items-center gap-4 px-2">
      <div className="relative shrink-0">
        <div className="relative size-14 overflow-hidden rounded-full border-2 border-white p-0.5 shadow-avatar">
          <DoctorAvatar
            src={data.doctorImageUrl}
            alt={data.doctorName}
            fallbackSrc="/images/doctors/waiting-avatar.png"
          />
        </div>
        <span className="absolute bottom-0 right-0 size-4 rounded-full border-2 border-white bg-primary" />
      </div>
      <div>
        <p className="text-base font-bold leading-6 text-[#191c1e]">
          {data.viewerRole === "doctor"
            ? "เตรียมเข้าห้องปรึกษา..."
            : data.consultationStatus === "live"
              ? "คุณหมอพร้อมให้คำปรึกษาแล้ว"
              : "คุณหมอกำลังเตรียมความพร้อม..."}
        </p>
        <p className="text-xs leading-4 text-[#3e494a]">{data.doctorName}</p>
        <p className="mt-1 text-[11px] leading-4 text-[#3e494a]">นัดหมาย {data.scheduledLabel}</p>
      </div>
    </section>
  );
}

function PreparationChecklist() {
  const items = [
    {
      icon: Wifi,
      label: "ตรวจสอบความเสถียรของอินเทอร์เน็ต"
    },
    {
      icon: MonitorCheck,
      label: "เตรียมข้อมูลอาการเบื้องต้น"
    },
    {
      icon: ShieldCheck,
      label: "อยู่ในสถานที่ที่เงียบสงบและมีความเป็นส่วนตัว"
    }
  ];

  return (
    <section className="rounded-[24px] border border-white/40 bg-white/70 p-[25px] shadow-chip backdrop-blur-topbar">
      <div className="mb-6 flex items-center gap-2">
        <MonitorCheck aria-hidden="true" className="size-5 text-primary" strokeWidth={2.2} />
        <h2 className="text-lg font-bold leading-7 text-[#191c1e]">คำแนะนำในการเตรียมตัว</h2>
      </div>
      <div className="flex flex-col gap-5">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className="flex items-start gap-3">
              <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#617085]/20 text-[#64748b]">
                <Icon aria-hidden="true" className="size-3.5" strokeWidth={2} />
              </span>
              <p className="text-sm leading-[22.75px] text-[#3e494a]">{item.label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FooterActions({ data }: { data: ConsultationWaitingRoomData }) {
  return (
    <section className="flex flex-col gap-4 pt-2">
      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#e0e3e5] px-6 py-4 text-sm font-bold leading-5 text-primary"
      >
        <Camera aria-hidden="true" className="size-5" strokeWidth={2.15} />
        ทดสอบกล้องและไมโครโฟน
      </button>
      <div className="flex flex-col gap-2">
        {data.liveHref ? (
          <Link
            href={data.liveHref as Route}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-gradient py-5 text-lg font-bold leading-7 text-white shadow-booking"
          >
            เข้าสู่ห้องปรึกษา
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#e2e8f0] py-5 text-lg font-bold leading-7 text-[#94a3b8] shadow-qr-inset"
          >
            <Lock aria-hidden="true" className="size-5" strokeWidth={2.1} />
            เข้าสู่ห้องปรึกษา
          </span>
        )}
        <p className="text-center text-[11px] leading-[16.5px] text-[#3e494a]">
          {data.canEnterLive ? "พร้อมเข้าสู่ห้องปรึกษา" : "ปุ่มจะเปิดให้กดเมื่อถึงเวลานัด"}
        </p>
      </div>
    </section>
  );
}
