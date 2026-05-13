import Link from "next/link";
import { ArrowLeft, Check, CheckCircle2 } from "lucide-react";

type TrackingStep = {
  title: string;
  description?: string;
  status: "done" | "active" | "pending";
};

const trackingSteps: TrackingStep[] = [
  {
    title: "รับคำสั่งซื้อแล้ว",
    description: "28 Mar 2026, 13:16",
    status: "done"
  },
  {
    title: "กำลังจัดเตรียมยาโดยเภสัชกร",
    description: "ระบบกำลังตรวจสอบความถูกต้องของใบสั่งยา",
    status: "active"
  },
  {
    title: "อยู่ระหว่างการจัดส่ง",
    description: "เลขพัสดุ: -",
    status: "pending"
  },
  {
    title: "จัดส่งสำเร็จ",
    status: "pending"
  }
];

export function PaymentSuccessTracking() {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#f7f9fb] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <SuccessHeader />

      <main className="mx-auto flex w-full max-w-mobile flex-col gap-8 px-6 py-8">
        <section className="flex flex-col items-center rounded-[24px] border border-white/20 bg-white/70 p-8 text-center shadow-[0_20px_50px_rgba(0,96,103,0.08)] backdrop-blur-[24px]">
          <div className="mb-7 flex size-20 items-center justify-center rounded-full bg-primary-gradient text-white shadow-[0_12px_24px_rgba(0,96,103,0.24)]">
            <CheckCircle2 aria-hidden="true" className="size-10 fill-white text-primary" />
          </div>

          <h1 className="mb-7 text-xl font-extrabold leading-7 tracking-tight text-primary">
            ตรวจสอบสลิปสำเร็จ (Verified)
          </h1>

          <dl className="w-full space-y-4 border-y border-[#bdc9ca]/15 py-6 text-left">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-[#3e494a]">ผู้โอน</dt>
              <dd className="text-right font-semibold text-[#191c1e]">นายสมชาย ใจดี</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-[#3e494a]">ยอดเงิน</dt>
              <dd className="text-right text-lg font-extrabold text-primary">฿1,800.00</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-[#3e494a]">วันเวลา</dt>
              <dd className="text-right text-sm text-[#191c1e]">28 มี.ค. 2569 - 13:15</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-[#3e494a]">สถานะ</dt>
              <dd className="flex items-center gap-1 text-sm font-medium text-[#2e7d32]">
                รายการถูกต้อง
                <CheckCircle2 aria-hidden="true" className="size-4 fill-[#2e7d32] text-white" />
              </dd>
            </div>
          </dl>

          <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6e797a]/60">
            Powered by SlipVerify API
          </p>
        </section>

        <section className="rounded-[24px] border border-white/20 bg-white/70 p-8 shadow-[0_20px_50px_rgba(0,96,103,0.04)] backdrop-blur-[24px]">
          <p className="mb-10 text-base font-semibold leading-8 text-[#191c1e]">
            ขอบคุณที่ใช้บริการ ข้อมูลการสั่งซื้อของคุณถูกส่งไปยังห้องยาเรียบร้อยแล้ว
          </p>

          <div className="space-y-10">
            {trackingSteps.map((step, index) => (
              <TrackingStepRow key={step.title} step={step} isLast={index === trackingSteps.length - 1} />
            ))}
          </div>
        </section>

        <section className="flex flex-col items-center gap-6 pt-4">
          <Link href="/store/orders" className="text-sm font-bold tracking-wide text-primary underline-offset-4 hover:underline">
            ดูคำสั่งซื้อของฉัน
          </Link>
          <Link href="/store" className="text-sm font-bold tracking-wide text-primary underline-offset-4 hover:underline">
            กลับสู่หน้าหลัก
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-4 py-1.5">
            <span className="size-1.5 rounded-full bg-primary" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Pharmacy system synced
            </span>
          </div>
        </section>
      </main>

      <div className="pointer-events-none fixed left-[-10%] top-[-10%] -z-10 h-[50%] w-[50%] rounded-full bg-primary/5 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-[-10%] right-[-10%] -z-10 h-[50%] w-[50%] rounded-full bg-primary/10 blur-[120px]" />
    </div>
  );
}

function SuccessHeader() {
  return (
    <header className="sticky top-0 z-header bg-white/70 shadow-[0_40px_40px_-15px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-16 w-full max-w-mobile items-center justify-between px-7">
        <div className="flex items-center gap-4">
          <Link href="/store/checkout" aria-label="Back to checkout" className="text-primary">
            <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.4} />
          </Link>
          <p className="text-lg font-bold tracking-wide text-primary">Payment Success</p>
        </div>
        <div className="size-8" />
      </div>
    </header>
  );
}

function TrackingStepRow({ step, isLast }: { step: TrackingStep; isLast: boolean }) {
  const isDone = step.status === "done";
  const isActive = step.status === "active";

  return (
    <div className="relative flex gap-6">
      {!isLast ? (
        <span
          aria-hidden="true"
          className={`absolute left-[11px] top-8 h-[calc(100%+1rem)] w-0.5 ${isDone ? "bg-primary" : "bg-[#e0e3e5]"}`}
        />
      ) : null}

      <span
        className={
          isDone
            ? "z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm"
            : isActive
              ? "z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-4 border-primary bg-white"
              : "z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e6e8ea]"
        }
      >
        {isDone ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : null}
        {isActive ? <span className="size-1.5 animate-pulse rounded-full bg-primary" /> : null}
        {step.status === "pending" ? <span className="size-1.5 rounded-full bg-[#bdc9ca]" /> : null}
      </span>

      <div>
        <h2
          className={
            isActive
              ? "text-sm font-bold leading-5 text-primary"
              : isDone
                ? "text-sm font-bold leading-5 text-[#191c1e]"
                : "text-sm font-medium leading-5 text-[#6e797a]"
          }
        >
          {step.title}
        </h2>
        {step.description ? (
          <p className={`mt-1 text-xs leading-5 ${step.status === "pending" ? "text-[#bdc9ca]" : "text-[#3e494a]"}`}>
            {step.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
