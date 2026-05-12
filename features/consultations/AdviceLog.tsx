import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  CalendarDays,
  Download,
  FileDown,
  FileText,
  MessageSquare,
  Pill,
  PlusSquare,
  ShoppingCart,
  UserRound,
  X
} from "lucide-react";

const prescriptions = [
  {
    name: "Paracetamol 500mg",
    instruction: "1 เม็ด หลังอาหาร เช้า-เย็น (เมื่อมีอาการปวด)",
    icon: PlusSquare
  },
  {
    name: "Amoxicillin 500mg",
    instruction: "1 เม็ด หลังอาหาร เช้า-เย็น (ติดต่อกันจนครบ 7 วัน)",
    icon: Pill
  }
];

export function AdviceLog() {
  return (
    <section className="-mx-4 min-h-dvh bg-advice-radial pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <AdviceTopBar />

      <main className="space-y-6 px-6 pt-20">
        <DoctorSummary />
        <DoctorNote />
        <PrescriptionList />
        <AttachmentCard />
        <Actions />
      </main>

      <AdviceBottomNav />
    </section>
  );
}

function AdviceTopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-header mx-auto flex h-16 max-w-[480px] items-center bg-white/70 px-7 shadow-booking-top backdrop-blur-payment">
      <Link href="/consult/live" aria-label="Close advice log" className="flex size-10 items-center justify-start text-primary">
        <X aria-hidden="true" className="size-6" strokeWidth={2.2} />
      </Link>
      <h1 className="pl-2 text-lg font-bold leading-7 tracking-normal text-primary">สรุปผลการปรึกษา</h1>
    </header>
  );
}

function DoctorSummary() {
  return (
    <section className="rounded-[24px] border border-white/40 bg-white/70 p-6 shadow-payment-card backdrop-blur-payment">
      <div className="flex items-center gap-4">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-full border-2 border-white/50 shadow-chip">
          <Image
            src="/images/doctors/waiting-profile.png"
            alt="นพ. ธีรภัทร์ รัตนวานิช"
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold leading-6 text-primary">นพ. ธีรภัทร์ รัตนวานิช</h2>
          <p className="text-sm font-medium leading-5 text-[#3e494a]">อายุรกรรม (Internal Medicine)</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs leading-4 text-[#3e494a]/70">
            <CalendarDays aria-hidden="true" className="size-4" />
            10 พฤษภาคม 2567 | 10:15 - 10:30
          </p>
        </div>
      </div>
    </section>
  );
}

function DoctorNote() {
  return (
    <section className="space-y-3">
      <h2 className="ml-1 text-base font-bold leading-6 text-[#191c1e]">บันทึกสรุปจากแพทย์</h2>
      <div className="rounded-[24px] bg-white p-5 shadow-chip">
        <p className="text-[15px] leading-relaxed text-[#3e494a]">
          อาการปวดศีรษะอาจเกิดจากความเครียดและการพักผ่อนไม่เพียงพอ
          แนะนำให้รับประทานยาตามสั่งและพักผ่อนอย่างน้อย 8 ชั่วโมงต่อวัน
          หากอาการไม่ดีขึ้นภายใน 3 วัน กรุณากลับมาพบแพทย์อีกครั้ง
        </p>
      </div>
    </section>
  );
}

function PrescriptionList() {
  return (
    <section className="space-y-3">
      <div className="ml-1 flex items-center justify-between">
        <h2 className="text-base font-bold leading-6 text-[#191c1e]">รายการยาที่สั่งจ่าย</h2>
        <span className="rounded-full bg-primary/5 px-2 py-1 text-xs font-bold uppercase tracking-wider text-primary">
          2 items
        </span>
      </div>

      <div className="space-y-3">
        {prescriptions.map((item) => {
          const Icon = item.icon;

          return (
            <article key={item.name} className="flex items-start gap-4 rounded-[24px] bg-white p-4 shadow-chip">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/5 text-primary">
                <Icon aria-hidden="true" className="size-6" strokeWidth={2.1} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-bold leading-6 text-[#191c1e]">{item.name}</h3>
                <p className="mt-1 text-sm leading-6 text-[#3e494a]">{item.instruction}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AttachmentCard() {
  return (
    <section className="space-y-3">
      <h2 className="ml-1 text-base font-bold leading-6 text-[#191c1e]">เอกสารแนบ</h2>
      <div className="flex items-center gap-3 rounded-[24px] border border-dashed border-[#bdc9ca] bg-[#f2f4f6]/50 p-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger">
          <FileText aria-hidden="true" className="size-7" strokeWidth={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#191c1e]">ใบสั่งยา_0421.pdf</p>
          <p className="text-[10px] text-[#3e494a]">PDF • 1.2 MB</p>
        </div>
        <button type="button" aria-label="Download prescription PDF" className="text-primary">
          <Download aria-hidden="true" className="size-6" strokeWidth={2.2} />
        </button>
      </div>
    </section>
  );
}

function Actions() {
  return (
    <section className="space-y-3 pt-4">
      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-gradient py-4 text-base font-bold text-white shadow-selected-date"
      >
        <ShoppingCart aria-hidden="true" className="size-6" strokeWidth={2.2} />
        สั่งซื้อยาตามใบสั่งแพทย์
      </button>
      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-primary/20 py-4 text-base font-bold text-primary"
      >
        <FileDown aria-hidden="true" className="size-6" strokeWidth={2.2} />
        ดาวน์โหลดใบสรุปผล (PDF)
      </button>
    </section>
  );
}

function AdviceBottomNav() {
  const items = [
    { label: "Chat", icon: MessageSquare },
    { label: "Advice", icon: FileText, active: true },
    { label: "Health", icon: Activity },
    { label: "Profile", icon: UserRound }
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-footer mx-auto flex max-w-[480px] items-center justify-around rounded-t-[24px] bg-white/70 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-waiting-nav backdrop-blur-payment">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <button
            key={item.label}
            type="button"
            className={
              item.active
                ? "flex flex-col items-center justify-center rounded-full bg-[#007b83]/10 px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary"
                : "flex flex-col items-center justify-center text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]"
            }
          >
            <Icon aria-hidden="true" className="size-6" strokeWidth={2} />
            <span className={item.active ? "mt-0.5" : "mt-1"}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
