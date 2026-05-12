import Image from "next/image";
import Link from "next/link";
import {
  Camera,
  Home,
  Lock,
  MessageSquare,
  MonitorCheck,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Wifi
} from "lucide-react";

export function ConsultWaitingRoom() {
  return (
    <section className="-mx-4 min-h-dvh bg-app pb-[calc(8.25rem+env(safe-area-inset-bottom))]">
      <WaitingRoomTopBar />

      <div className="flex flex-col gap-8 px-7 pt-24">
        <HeaderSection />
        <CountdownCard />
        <DoctorBrief />
        <PreparationChecklist />
        <FooterActions />
      </div>

      <WaitingRoomBottomNav />
    </section>
  );
}

function WaitingRoomTopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-header mx-auto flex h-[72px] max-w-[480px] items-center justify-between bg-white/70 px-7 shadow-waiting-top backdrop-blur-payment">
      <div className="flex items-center gap-3">
        <div className="relative size-10 overflow-hidden rounded-full border-2 border-[#7ad5dd] p-0.5 shadow-chip">
          <Image
            src="/images/doctors/waiting-profile.png"
            alt="Doctor profile"
            fill
            sizes="40px"
            className="object-cover"
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

function HeaderSection() {
  return (
    <section className="flex flex-col items-start gap-2">
      <h2 className="text-2xl font-bold leading-8 tracking-normal text-primary">ห้องนั่งรอปรึกษา</h2>
      <div className="flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-[17px] py-[9px]">
        <span className="size-2 rounded-full bg-primary" />
        <span className="text-xs font-bold leading-4 tracking-normal text-primary">
          ยืนยันการชำระเงินเรียบร้อยแล้ว
        </span>
      </div>
    </section>
  );
}

function CountdownCard() {
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-[#bdc9ca]/15 bg-white/70 p-[33px] text-center shadow-waiting-countdown backdrop-blur-topbar">
      <p className="pb-2 text-sm font-medium uppercase leading-5 tracking-[1.4px] text-[#3e494a]">
        Appointment starts in
      </p>
      <div className="text-5xl font-bold leading-[48px] tracking-normal text-primary">
        <p>เริ่มในอีก</p>
        <p>04:59</p>
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

function DoctorBrief() {
  return (
    <section className="flex items-center gap-4 px-2">
      <div className="relative shrink-0">
        <div className="relative size-14 overflow-hidden rounded-full border-2 border-white p-0.5 shadow-avatar">
          <Image
            src="/images/doctors/waiting-avatar.png"
            alt="Doctor avatar"
            fill
            sizes="56px"
            className="object-cover"
          />
        </div>
        <span className="absolute bottom-0 right-0 size-4 rounded-full border-2 border-white bg-primary" />
      </div>
      <div>
        <p className="text-base font-bold leading-6 text-[#191c1e]">คุณหมอกำลังเตรียมความพร้อม...</p>
        <p className="text-xs leading-4 text-[#3e494a]">นพ. ธีรภัทร์ รัตนวานิช</p>
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

function FooterActions() {
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
        <Link
          href="/consult/live"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#e2e8f0] py-5 text-lg font-bold leading-7 text-[#94a3b8] shadow-qr-inset"
        >
          <Lock aria-hidden="true" className="size-5" strokeWidth={2.1} />
          เข้าสู่ห้องปรึกษา
        </Link>
        <p className="text-center text-[11px] leading-[16.5px] text-[#3e494a]">ปุ่มจะเปิดให้กดเมื่อถึงเวลา</p>
      </div>
    </section>
  );
}

function WaitingRoomBottomNav() {
  const items = [
    { label: "Home", icon: Home },
    { label: "Vitals", icon: Stethoscope, active: true },
    { label: "Chat", icon: MessageSquare },
    { label: "Profile", icon: UserRound }
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-footer mx-auto flex h-[95px] max-w-[480px] items-center justify-between rounded-t-[24px] bg-white/70 px-8 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 shadow-waiting-nav backdrop-blur-payment">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <button
            key={item.label}
            type="button"
            className={
              item.active
                ? "flex min-w-16 flex-col items-center justify-center rounded-full bg-[#ccfbf1]/50 px-5 py-2 text-[10px] font-medium uppercase leading-[15px] tracking-normal text-[#134e4a]"
                : "flex min-w-16 flex-col items-center justify-center px-5 py-2 text-[10px] font-medium uppercase leading-[15px] tracking-normal text-[#64748b]"
            }
          >
            <Icon aria-hidden="true" className="size-5" strokeWidth={2} />
            <span className="pt-1">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
