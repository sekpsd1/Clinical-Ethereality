import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CloudUpload,
  Info,
  ShieldAlert
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { verifyConsultationSlipAction } from "@/features/consultations/payment/actions";
import type { ConsultationPaymentData, ConsultationPaymentDetail } from "@/features/consultations/payment/types";

export function ConsultPaymentCheckout({ data }: { data: ConsultationPaymentData }) {
  const consultation = data.consultation;

  return (
    <section className="-mx-4 min-h-dvh bg-payment-radial pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <PaymentTopBar backHref={consultation?.appointmentHref ?? "/consult/booking/somchai"} />

      <div className="flex flex-col gap-6 px-6 pt-24">
        {data.unavailable ? (
          <PaymentStateCard
            tone="danger"
            title="Payment is temporarily unavailable"
            body="We could not load the consultation payment details. Please try again from your appointment detail."
            href="/consult"
            cta="Back to consult"
          />
        ) : consultation ? (
          <>
            <PaymentStatusNotice data={data} />
            <BookingSummaryCard consultation={consultation} />

            {consultation.status === "scheduled" || consultation.status === "live" ? (
              <PaymentStateCard
                tone="success"
                title="Payment already confirmed"
                body="Your consultation is ready. Open the waiting room before the scheduled time."
                href={consultation.waitingRoomHref}
                cta="Open waiting room"
              />
            ) : consultation.status === "cancelled" || consultation.status === "completed" ? (
              <PaymentStateCard
                tone="neutral"
                title="Payment is closed"
                body="This consultation no longer accepts payment changes."
                href={consultation.appointmentHref}
                cta="View appointment"
              />
            ) : (
              <>
                <PromptPayCard consultation={consultation} />
                <SlipVerificationSection consultation={consultation} />
              </>
            )}
          </>
        ) : (
          <PaymentStateCard
            tone="danger"
            title="Consultation not found"
            body="This payment link may be expired, moved, or scoped to another signed-in customer."
            href="/consult"
            cta="Back to consult"
          />
        )}
      </div>
    </section>
  );
}

function PaymentTopBar({ backHref }: { backHref: string }) {
  return (
    <header className="fixed inset-x-0 top-0 z-header mx-auto flex h-16 max-w-[480px] items-center bg-white/70 px-6 shadow-payment-top backdrop-blur-payment">
      <Link href={backHref as Route} aria-label="Back to appointment" className="flex size-10 items-center justify-start text-primary">
        <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.25} />
      </Link>
      <h1 className="pl-2 text-lg font-bold leading-7 tracking-normal text-[#115e59]">Consultation payment</h1>
    </header>
  );
}

function PaymentStatusNotice({ data }: { data: ConsultationPaymentData }) {
  if (data.paymentStatus === "idle") {
    return null;
  }

  const messages = {
    invalid: {
      title: "Slip details needed",
      body: "Paste the QR payload from the slip or provide a hosted slip image URL before submitting.",
      tone: "warning" as const
    },
    rejected: {
      title: "Slip could not be verified",
      body: "The provider rejected this slip, amount, or receiver details. Please check the transfer and submit again.",
      tone: "danger" as const
    },
    provider_error: {
      title: "Verification provider unavailable",
      body: "SlipOK or EasySlip could not complete the check right now. Confirm the API key and try again.",
      tone: "warning" as const
    },
    not_found: {
      title: "Consultation not found",
      body: "Open the payment page from your appointment detail.",
      tone: "danger" as const
    }
  };
  const message = messages[data.paymentStatus];

  return (
    <div className="rounded-[20px] border border-[#bdc9ca]/15 bg-white/75 p-4 shadow-payment-card backdrop-blur-topbar">
      <div className="flex items-start gap-3">
        <span
          className={
            message.tone === "danger"
              ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-[#ba1a1a]/10 text-[#ba1a1a]"
              : "flex size-10 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning"
          }
        >
          <ShieldAlert aria-hidden="true" className="size-5" strokeWidth={2.25} />
        </span>
        <div>
          <h2 className="text-sm font-extrabold leading-5 text-[#191c1e]">{message.title}</h2>
          <p className="mt-1 text-xs font-medium leading-5 text-[#3e494a]">{message.body}</p>
        </div>
      </div>
    </div>
  );
}

function BookingSummaryCard({ consultation }: { consultation: ConsultationPaymentDetail }) {
  return (
    <article className="rounded-[24px] border border-[#bdc9ca]/15 bg-white/70 p-[21px] shadow-payment-card backdrop-blur-topbar">
      <div className="flex items-start gap-4">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-full border-2 border-primary/10 p-0.5">
          <Image src={consultation.doctorAvatarUrl} alt={consultation.doctorName} fill sizes="56px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold leading-[22.5px] text-primary">{consultation.doctorName}</h2>
              <p className="truncate text-xs font-semibold leading-5 text-[#3e494a]">{consultation.doctorSpecialty}</p>
            </div>
            <StatusBadge tone={consultation.status === "pending_payment" ? "warning" : "success"}>{consultation.statusLabel}</StatusBadge>
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm leading-5 text-[#3e494a]">
            <CalendarDays aria-hidden="true" className="size-3.5 text-[#3e494a]" />
            {consultation.scheduledDate} at {consultation.scheduledTime}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between border-t border-[#bdc9ca]/20 pt-[13px]">
        <p className="text-base leading-6 text-[#3e494a]">Amount due</p>
        <p className="text-primary">
          <span className="font-display text-2xl font-extrabold leading-8">{consultation.feeLabel}</span>
        </p>
      </div>
    </article>
  );
}

function PromptPayCard({ consultation }: { consultation: ConsultationPaymentDetail }) {
  return (
    <article className="flex flex-col items-center rounded-[24px] border border-[#bdc9ca]/15 bg-white/70 p-[25px] shadow-promptpay backdrop-blur-topbar">
      <div className="pb-4">
        <Image src="/images/payments/promptpay-logo.png" alt="PromptPay" width={32} height={32} className="size-8 object-contain" />
      </div>

      <div className="rounded-2xl border border-[#bdc9ca]/30 bg-white p-[17px] shadow-qr-inset">
        {consultation.promptPay.qrDataUrl ? (
          <Image
            src={consultation.promptPay.qrDataUrl}
            alt={`PromptPay QR code for ${consultation.feeLabel}`}
            width={208}
            height={208}
            className="size-[208px] object-contain"
          />
        ) : (
          <div className="flex size-[208px] items-center justify-center rounded-xl bg-[#f2f4f6] p-6 text-center text-sm font-bold leading-6 text-[#3e494a]">
            PromptPay QR is not configured
          </div>
        )}
      </div>

      <p className="pt-4 text-center text-sm leading-5 text-[#3e494a]">Scan to pay</p>
      <p className="pb-4 pt-1 text-center text-xl font-bold leading-7 text-primary">Amount: {consultation.feeLabel}</p>

      <div className="mb-4 flex w-full flex-col items-center gap-1 rounded-lg bg-[#f2f4f6] px-4 py-3 text-center">
        <p className="text-xs font-bold uppercase leading-4 tracking-normal text-[#3e494a]">PromptPay account</p>
        <p className="text-sm font-bold leading-5 tracking-[1.4px] text-primary">{consultation.promptPay.promptPayIdLabel}</p>
      </div>

      <div className="flex gap-2 rounded-lg bg-primary/5 p-3">
        <Info aria-hidden="true" className="mt-0.5 size-[15px] shrink-0 text-primary" />
        <p className="text-[11px] italic leading-[17.88px] text-[#3e494a]">
          This QR is generated for the consultation amount when `THAI_QR_PROMPTPAY_ID` is configured.
        </p>
      </div>
    </article>
  );
}

function SlipVerificationSection({ consultation }: { consultation: ConsultationPaymentDetail }) {
  return (
    <form action={verifyConsultationSlipAction} className="flex flex-col gap-3 pb-2">
      <input type="hidden" name="consultationId" value={consultation.id} />

      <label className="px-1 text-sm font-bold leading-5 text-[#191c1e]" htmlFor="qrPayload">
        Transfer slip verification
      </label>

      <div className="rounded-[24px] border-2 border-dashed border-primary/30 bg-white/70 p-5 backdrop-blur-topbar">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#96f1fa] text-primary">
            <CloudUpload aria-hidden="true" className="size-6" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-5 text-primary">Automatic SlipOK / EasySlip check</p>
            <p className="mt-1 text-xs leading-5 text-[#3e494a]">
              Paste the QR payload from the slip. If QR extraction is unavailable, use a hosted slip image URL.
            </p>
          </div>
        </div>

        <textarea
          id="qrPayload"
          name="qrPayload"
          rows={3}
          placeholder="Paste slip QR payload"
          className="mt-4 w-full resize-none rounded-[16px] border border-[#bdc9ca]/40 bg-white/85 px-4 py-3 text-sm leading-6 text-[#191c1e] outline-none ring-primary/20 placeholder:text-[#3e494a]/45 focus:ring-2"
        />

        <input
          name="imageUrl"
          type="url"
          placeholder="Optional hosted slip image URL"
          className="mt-3 h-12 w-full rounded-[16px] border border-[#bdc9ca]/40 bg-white/85 px-4 text-sm text-[#191c1e] outline-none ring-primary/20 placeholder:text-[#3e494a]/45 focus:ring-2"
        />
      </div>

      <button
        type="submit"
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary-gradient py-4 text-base font-bold leading-6 text-white shadow-selected-date"
      >
        <CheckCircle2 aria-hidden="true" className="size-5" strokeWidth={2.25} />
        Verify slip and confirm
      </button>
    </form>
  );
}

function PaymentStateCard({
  tone,
  title,
  body,
  href,
  cta
}: {
  tone: "neutral" | "success" | "danger";
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <article className="rounded-[24px] border border-[#bdc9ca]/15 bg-white/75 p-6 text-center shadow-payment-card backdrop-blur-topbar">
      <StatusBadge tone={tone}>{title}</StatusBadge>
      <p className="mt-4 text-sm leading-6 text-[#3e494a]">{body}</p>
      <Link
        href={href as Route}
        className="mt-6 flex h-14 w-full items-center justify-center rounded-full bg-primary-gradient px-5 text-sm font-bold leading-5 text-white shadow-booking"
      >
        {cta}
      </Link>
    </article>
  );
}
