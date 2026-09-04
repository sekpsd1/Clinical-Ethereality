import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Info,
  RotateCcw,
  ShieldAlert
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DoctorAvatar } from "@/features/consultations/DoctorAvatar";
import { verifyConsultationSlipAction } from "@/features/consultations/payment/actions";
import { PrivateSlipUpload } from "@/features/payments/PrivateSlipUpload";
import type {
  ConsultationPaymentData,
  ConsultationPaymentDetail,
  ConsultationPaymentStatus
} from "@/features/consultations/payment/types";

export function ConsultPaymentCheckout({ data }: { data: ConsultationPaymentData }) {
  const consultation = data.consultation;

  return (
    <section className="-mx-4 min-h-dvh bg-payment-radial pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <PaymentTopBar backHref={consultation?.appointmentHref ?? "/consult/booking/somchai"} />

      <div className="flex flex-col gap-6 px-6 pt-24">
        {data.unavailable ? (
          <PaymentStateCard
            tone="danger"
            title="ยังโหลดข้อมูลชำระเงินไม่ได้"
            body="กรุณาลองใหม่จากหน้ารายละเอียดนัดหมาย"
            href="/consult"
            cta="กลับไปหน้าปรึกษา"
          />
        ) : consultation ? (
          <>
            <PaymentStatusNotice data={data} />
            <BookingSummaryCard consultation={consultation} />
            <ConsultationPaymentStatusCard consultation={consultation} paymentStatus={data.paymentStatus} />

            {consultation.status === "scheduled" || consultation.status === "live" ? (
              <PaymentStateCard
                tone="success"
                title="ยืนยันการชำระเงินแล้ว"
                body="การปรึกษาพร้อมแล้ว กรุณาเปิดห้องรอก่อนเวลานัด"
                href={consultation.waitingRoomHref}
                cta="เปิดห้องรอ"
              />
            ) : consultation.status === "cancelled" ? (
              <PaymentStateCard
                tone="danger"
                title="เวลาจองหมดอายุ"
                body="ระบบปล่อยเวลานัดหมายนี้คืนแล้ว กรุณาเลือกเวลาปรึกษาใหม่ก่อนชำระเงิน"
                href="/consult/booking/somchai"
                cta="เลือกเวลาปรึกษาใหม่"
              />
            ) : consultation.status === "completed" ? (
              <PaymentStateCard
                tone="neutral"
                title="ปิดขั้นตอนชำระเงินแล้ว"
                body="การปรึกษานี้ไม่รับการเปลี่ยนแปลงการชำระเงินแล้ว"
                href={consultation.appointmentHref}
                cta="ดูนัดหมาย"
              />
            ) : (
              <>
                <PromptPayCard consultation={consultation} />
                {consultation.privateSlipAttachmentId ? (
                  <PrivateSlipVerification
                    attachmentId={consultation.privateSlipAttachmentId}
                    consultationId={consultation.id}
                    retryAfterSeconds={consultation.verificationRetryAfterSeconds}
                  />
                ) : (
                  <PrivateSlipUpload consultationId={consultation.id} referenceLabel="ค่าปรึกษาแพทย์" />
                )}
              </>
            )}
          </>
        ) : (
          <PaymentStateCard
            tone="danger"
            title="ไม่พบรายการปรึกษา"
            body="ลิงก์ชำระเงินนี้อาจหมดอายุ ถูกย้าย หรือเป็นของบัญชีอื่น"
            href="/consult"
            cta="กลับไปหน้าปรึกษา"
          />
        )}
      </div>
    </section>
  );
}

function PaymentTopBar({ backHref }: { backHref: string }) {
  return (
    <header className="fixed inset-x-0 top-0 z-header mx-auto flex h-16 max-w-[480px] items-center bg-white/70 px-6 shadow-payment-top backdrop-blur-payment">
      <Link href={backHref as Route} aria-label="กลับไปหน้ารายละเอียดนัดหมาย" className="flex size-10 items-center justify-start text-primary">
        <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.25} />
      </Link>
      <h1 className="pl-2 text-lg font-bold leading-7 tracking-normal text-[#115e59]">ชำระค่าปรึกษา</h1>
    </header>
  );
}

function PaymentStatusNotice({ data }: { data: ConsultationPaymentData }) {
  if (data.paymentStatus === "idle") {
    return null;
  }

  const messages = {
    invalid: {
      title: "ต้องกรอกข้อมูลสลิป",
      body: "กรุณาวาง QR payload จากสลิป หรือใส่ URL รูปสลิปก่อนส่งตรวจสอบ",
      tone: "warning" as const
    },
    rejected: {
      title: "ตรวจสอบสลิปไม่ผ่าน",
      body: "ผู้ให้บริการปฏิเสธสลิป ยอดเงิน หรือข้อมูลผู้รับ กรุณาตรวจสอบรายการโอนและส่งใหม่",
      tone: "danger" as const
    },
    expired: {
      title: "เวลาจองหมดอายุ",
      body: "ระบบปล่อยเวลานัดหมายนี้คืนแล้ว กรุณาเลือกเวลาปรึกษาใหม่ก่อนส่งข้อมูลชำระเงิน",
      tone: "danger" as const
    },
    provider_error: {
      title: "ระบบตรวจสอบสลิปไม่พร้อมใช้งาน",
      body: "SlipOK ยังตรวจสอบไม่ได้ในขณะนี้ ระบบยังไม่ยืนยันการชำระเงิน กรุณารอแล้วลองใหม่",
      tone: "warning" as const
    },
    cooldown: {
      title: "กรุณารอก่อนตรวจสอบซ้ำ",
      body: "ระบบกำลังป้องกันการส่งตรวจสอบซ้ำ กรุณารอสักครู่แล้วลองใหม่",
      tone: "warning" as const
    },
    not_found: {
      title: "ไม่พบรายการปรึกษา",
      body: "กรุณาเปิดหน้าชำระเงินจากหน้ารายละเอียดนัดหมาย",
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

function PrivateSlipVerification({
  attachmentId,
  consultationId,
  retryAfterSeconds
}: {
  attachmentId: string;
  consultationId: string;
  retryAfterSeconds: number;
}) {
  const isCoolingDown = retryAfterSeconds > 0;

  return (
    <form action={verifyConsultationSlipAction} className="mt-6 rounded-[22px] border border-teal-200/80 bg-white/80 p-5 shadow-[0_10px_26px_rgba(0,96,103,0.05)]">
      <input name="consultationId" type="hidden" value={consultationId} />
      <input name="attachmentId" type="hidden" value={attachmentId} />
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-primary">
          <ShieldAlert aria-hidden="true" className="size-5" />
        </span>
        <div>
          <p className="text-sm font-extrabold text-primary">อัปโหลดสลิปแล้ว</p>
          <p className="mt-1 text-xs leading-5 text-[#3e494a]">
            ระบบจะส่งไฟล์ส่วนตัวให้ SlipOK ตรวจสอบโดยตรง โดยไม่ใช้ลิงก์สาธารณะ
          </p>
        </div>
      </div>
      {isCoolingDown ? (
        <p className="mt-4 text-xs font-semibold leading-5 text-[#3e494a]">
          ตรวจสอบซ้ำได้อีกในประมาณ {retryAfterSeconds} วินาที
        </p>
      ) : null}
      <button
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-gradient text-sm font-extrabold text-white shadow-[0_12px_24px_-8px_rgba(0,96,103,0.4)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isCoolingDown}
        type="submit"
      >
        <CheckCircle2 aria-hidden="true" className="size-4" strokeWidth={2.25} />
        ตรวจสอบสลิปอัตโนมัติ
      </button>
    </form>
  );
}

function getPaymentStatusTone(status: ConsultationPaymentDetail["status"]): "neutral" | "success" | "warning" | "danger" {
  if (status === "pending_payment" || status === "requested") {
    return "warning";
  }

  if (status === "scheduled" || status === "live") {
    return "success";
  }

  if (status === "cancelled") {
    return "danger";
  }

  return "neutral";
}

function ConsultationPaymentStatusCard({
  consultation,
  paymentStatus
}: {
  consultation: ConsultationPaymentDetail;
  paymentStatus: ConsultationPaymentStatus;
}) {
  const needsSlipRetry = paymentStatus === "invalid" || paymentStatus === "rejected" || paymentStatus === "provider_error";
  const content =
    consultation.status === "cancelled"
      ? {
          icon: RotateCcw,
          label: "เวลาจองหมดอายุ",
          title: "ต้องเลือกเวลาปรึกษาใหม่",
          body: "เวลานี้ถูกปล่อยคืนแล้ว ระบบจะไม่รับสลิปสำหรับนัดหมายนี้ เพื่อป้องกันการชำระเงินผิดรายการ",
          tone: "danger" as const
        }
      : consultation.status === "scheduled" || consultation.status === "live"
        ? {
            icon: CheckCircle2,
            label: "ชำระเงินแล้ว",
            title: "ยืนยันนัดหมายเรียบร้อย",
            body: "ระบบยืนยันค่าปรึกษาแล้ว สามารถเข้าไปยังห้องรอก่อนเวลานัดได้",
            tone: "success" as const
          }
        : consultation.status === "completed"
          ? {
              icon: CheckCircle2,
              label: "ปิดขั้นตอนแล้ว",
              title: "การปรึกษาเสร็จสิ้นแล้ว",
              body: "ขั้นตอนชำระเงินสำหรับนัดหมายนี้เสร็จสิ้นแล้ว",
              tone: "neutral" as const
            }
          : needsSlipRetry
            ? {
                icon: ShieldAlert,
                label: "ต้องตรวจสลิปใหม่",
                title: "ยังไม่ได้ยืนยันการชำระเงิน",
                body: "ตรวจสอบข้อมูลสลิปหรือ QR payload แล้วส่งตรวจอีกครั้งก่อนเวลาจองหมดอายุ",
                tone: "warning" as const
              }
            : {
                icon: Clock3,
                label: "รอชำระเงิน",
                title: "สำรองเวลานัดไว้ชั่วคราว",
                body: "ชำระค่าปรึกษาและส่งข้อมูลสลิปเพื่อยืนยันนัดหมาย หากปล่อยค้างเกินเวลาที่กำหนด ระบบจะคืน slot ให้ผู้อื่นเลือกได้",
                tone: "warning" as const
              };
  const Icon = content.icon;

  return (
    <article className="rounded-[20px] border border-[#bdc9ca]/15 bg-white/75 p-4 shadow-payment-card backdrop-blur-topbar">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="size-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <StatusBadge tone={content.tone}>{content.label}</StatusBadge>
          <h2 className="mt-2 text-base font-extrabold leading-6 text-[#191c1e]">{content.title}</h2>
          <p className="mt-1 text-sm leading-6 text-[#3e494a]">{content.body}</p>
        </div>
      </div>
    </article>
  );
}

function BookingSummaryCard({ consultation }: { consultation: ConsultationPaymentDetail }) {
  return (
    <article className="rounded-[24px] border border-[#bdc9ca]/15 bg-white/70 p-[21px] shadow-payment-card backdrop-blur-topbar">
      <div className="flex items-start gap-4">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-full border-2 border-primary/10 p-0.5">
          <DoctorAvatar src={consultation.doctorAvatarUrl} alt={consultation.doctorName} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold leading-[22.5px] text-primary">{consultation.doctorName}</h2>
              <p className="truncate text-xs font-semibold leading-5 text-[#3e494a]">{consultation.doctorSpecialty}</p>
            </div>
            <StatusBadge tone={getPaymentStatusTone(consultation.status)}>{consultation.statusLabel}</StatusBadge>
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm leading-5 text-[#3e494a]">
            <CalendarDays aria-hidden="true" className="size-3.5 text-[#3e494a]" />
            {consultation.scheduledDate} เวลา {consultation.scheduledTime}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between border-t border-[#bdc9ca]/20 pt-[13px]">
        <p className="text-base leading-6 text-[#3e494a]">ยอดที่ต้องชำระ</p>
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
            ยังไม่ได้ตั้งค่า PromptPay QR
          </div>
        )}
      </div>

      <p className="pt-4 text-center text-sm leading-5 text-[#3e494a]">สแกนเพื่อชำระเงิน</p>
      <p className="pb-4 pt-1 text-center text-xl font-bold leading-7 text-primary">ยอดชำระ: {consultation.feeLabel}</p>

      <div className="mb-4 flex w-full flex-col items-center gap-1 rounded-lg bg-[#f2f4f6] px-4 py-3 text-center">
        <p className="text-xs font-bold uppercase leading-4 tracking-normal text-[#3e494a]">บัญชีพร้อมเพย์</p>
        <p className="text-sm font-bold leading-5 tracking-[1.4px] text-primary">{consultation.promptPay.promptPayIdLabel}</p>
      </div>

      <div className="flex gap-2 rounded-lg bg-primary/5 p-3">
        <Info aria-hidden="true" className="mt-0.5 size-[15px] shrink-0 text-primary" />
        <p className="text-[11px] italic leading-[17.88px] text-[#3e494a]">
          QR นี้สร้างตามยอดค่าปรึกษาเมื่อมีการตั้งค่า `THAI_QR_PROMPTPAY_ID`
        </p>
      </div>
    </article>
  );
}

/*
 * Legacy hosted-URL/QR provider submission is intentionally disabled while
 * private server-side payment-slip storage is the checkout entry point.
 */
/* function SlipVerificationSection({ consultation }: { consultation: ConsultationPaymentDetail }) {
  return (
    <form action={verifyConsultationSlipAction} className="flex flex-col gap-3 pb-2">
      <input type="hidden" name="consultationId" value={consultation.id} />

      <label className="px-1 text-sm font-bold leading-5 text-[#191c1e]" htmlFor="qrPayload">
        ตรวจสอบสลิปโอนเงิน
      </label>

      <div className="rounded-[24px] border-2 border-dashed border-primary/30 bg-white/70 p-5 backdrop-blur-topbar">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#96f1fa] text-primary">
            <CloudUpload aria-hidden="true" className="size-6" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-5 text-primary">ตรวจสอบอัตโนมัติผ่าน SlipOK / EasySlip</p>
            <p className="mt-1 text-xs leading-5 text-[#3e494a]">
              วาง QR payload จากสลิป หากดึง QR ไม่ได้ให้ใช้ URL รูปสลิปที่อัปโหลดไว้
            </p>
          </div>
        </div>

        <textarea
          id="qrPayload"
          name="qrPayload"
          rows={3}
          placeholder="วาง QR payload จากสลิป"
          className="mt-4 w-full resize-none rounded-[16px] border border-[#bdc9ca]/40 bg-white/85 px-4 py-3 text-sm leading-6 text-[#191c1e] outline-none ring-primary/20 placeholder:text-[#3e494a]/45 focus:ring-2"
        />

        <input
          name="imageUrl"
          type="url"
          placeholder="URL รูปสลิป (ถ้ามี)"
          className="mt-3 h-12 w-full rounded-[16px] border border-[#bdc9ca]/40 bg-white/85 px-4 text-sm text-[#191c1e] outline-none ring-primary/20 placeholder:text-[#3e494a]/45 focus:ring-2"
        />
      </div>

      <button
        type="submit"
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary-gradient py-4 text-base font-bold leading-6 text-white shadow-selected-date"
      >
        <CheckCircle2 aria-hidden="true" className="size-5" strokeWidth={2.25} />
        ตรวจสอบสลิปและยืนยัน
      </button>
    </form>
  );
}

}
*/

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
