import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CalendarDays, CloudUpload, Home, Info, ReceiptText, UserRound } from "lucide-react";

export function ConsultPaymentCheckout() {
  return (
    <section className="-mx-4 min-h-dvh bg-payment-radial pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <PaymentTopBar />

      <div className="flex flex-col gap-6 px-6 pt-24">
        <BookingSummaryCard />
        <PromptPayCard />
        <SlipUploadSection />

        <Link
          href="/consult/waiting-room"
          className="flex w-full items-center justify-center rounded-full bg-primary-gradient py-4 text-base font-bold leading-6 text-white shadow-selected-date"
        >
          ส่งข้อมูลแจ้งชำระเงิน
        </Link>
      </div>

      <PaymentBottomNav />
    </section>
  );
}

function PaymentTopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-header mx-auto flex h-16 max-w-[480px] items-center bg-white/70 px-6 shadow-payment-top backdrop-blur-payment">
      <Link href="/consult/booking/somchai" aria-label="Back to booking" className="flex size-10 items-center justify-start text-primary">
        <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.25} />
      </Link>
      <h1 className="pl-2 text-lg font-bold leading-7 tracking-normal text-[#115e59]">ชำระค่าบริการ</h1>
    </header>
  );
}

function BookingSummaryCard() {
  return (
    <article className="rounded-[24px] border border-[#bdc9ca]/15 bg-white/70 p-[21px] shadow-payment-card backdrop-blur-topbar">
      <div className="flex items-center gap-4">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-full border-2 border-primary/10 p-0.5">
          <Image
            src="/images/doctors/somchai-payment.png"
            alt="นพ. สมชาย รัตนวงศาล"
            fill
            sizes="56px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold leading-[22.5px] text-primary">
            นพ. สมชาย รัตนวงศาล
          </h2>
          <div className="mt-1 flex items-center gap-1 text-sm leading-5 text-[#3e494a]">
            <CalendarDays aria-hidden="true" className="size-3.5 text-[#3e494a]" />
            10 พ.ค. 2567
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between border-t border-[#bdc9ca]/20 pt-[13px]">
        <p className="text-base leading-6 text-[#3e494a]">ยอดชำระสุทธิ</p>
        <p className="text-primary">
          <span className="font-display text-2xl font-extrabold leading-8">1,000</span>
          <span className="ml-1 text-sm leading-5">บาท</span>
        </p>
      </div>
    </article>
  );
}

function PromptPayCard() {
  return (
    <article className="flex flex-col items-center rounded-[24px] border border-[#bdc9ca]/15 bg-white/70 p-[25px] shadow-promptpay backdrop-blur-topbar">
      <div className="pb-4">
        <Image
          src="/images/payments/promptpay-logo.png"
          alt="PromptPay"
          width={32}
          height={32}
          className="size-8 object-contain"
        />
      </div>

      <div className="rounded-2xl border border-[#bdc9ca]/30 bg-white p-[17px] shadow-qr-inset">
        <Image
          src="/images/payments/promptpay-qr-1000.png"
          alt="PromptPay QR code for 1,000 THB"
          width={208}
          height={208}
          className="size-[208px] object-contain"
        />
      </div>

      <p className="pt-4 text-center text-sm leading-5 text-[#3e494a]">สแกนเพื่อชำระเงิน (Scan to Pay)</p>
      <p className="pb-4 pt-1 text-center text-xl font-bold leading-7 text-primary">ยอดที่ต้องชำระ: 1,000 บาท</p>

      <div className="mb-4 flex w-full flex-col items-center gap-1 rounded-lg bg-[#f2f4f6] px-4 py-3 text-center">
        <p className="text-xs font-bold uppercase leading-4 tracking-normal text-[#3e494a]">ข้อมูลบัญชี</p>
        <p className="text-sm font-bold leading-5 text-[#191c1e]">บริษัท มีเดีย ดีไซน์ จำกัด</p>
        <p className="text-sm font-bold leading-5 tracking-[1.4px] text-primary">08x-xxx-xxxx (PromptPay)</p>
      </div>

      <div className="flex gap-2 rounded-lg bg-primary/5 p-3">
        <Info aria-hidden="true" className="mt-0.5 size-[15px] shrink-0 text-primary" />
        <p className="text-[11px] italic leading-[17.88px] text-[#3e494a]">
          QR Code นี้มียอดเงินระบุไว้แล้ว กรุณาตรวจสอบยอดเงินก่อนยืนยันการโอน
        </p>
      </div>
    </article>
  );
}

function SlipUploadSection() {
  return (
    <section className="flex flex-col gap-3 pb-2">
      <label className="px-1 text-sm font-bold leading-5 text-[#191c1e]">หลักฐานการโอนเงิน</label>
      <button
        type="button"
        className="flex w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-primary/30 bg-white/70 p-[26px] backdrop-blur-topbar"
      >
        <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-[#96f1fa] text-primary">
          <CloudUpload aria-hidden="true" className="size-6" strokeWidth={2.25} />
        </span>
        <span className="text-center text-sm font-bold leading-5 text-primary">แนบหลักฐานการโอนเงิน</span>
        <span className="text-center text-[10px] leading-[15px] text-[#3e494a]">(Upload Transfer Slip)</span>
      </button>
    </section>
  );
}

function PaymentBottomNav() {
  const items = [
    { label: "หน้าหลัก", icon: Home },
    { label: "นัดหมาย", icon: CalendarDays },
    { label: "ชำระเงิน", icon: ReceiptText, active: true },
    { label: "โปรไฟล์", icon: UserRound }
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-footer mx-auto flex max-w-[480px] items-center justify-between rounded-t-[24px] bg-white/70 px-8 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 shadow-payment-nav backdrop-blur-payment">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <button
            key={item.label}
            type="button"
            className={
              item.active
                ? "flex min-w-14 flex-col items-center justify-center rounded-full bg-[#0d9488] p-3 text-[10px] leading-[15px] tracking-normal text-white shadow-payment-active"
                : "flex min-w-14 flex-col items-center justify-center p-2 text-[10px] leading-[15px] tracking-normal text-[#94a3b8]"
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
