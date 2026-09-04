"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { verifyConsultationSlipAction } from "@/features/consultations/payment/actions";

type ConsultationSlipVerificationProps = {
  attachmentId: string;
  consultationId: string;
  retryAfterSeconds: number;
  autoVerify: boolean;
};

export function ConsultationSlipVerification({
  attachmentId,
  consultationId,
  retryAfterSeconds,
  autoVerify
}: ConsultationSlipVerificationProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const hasStarted = useRef(false);
  const isCoolingDown = retryAfterSeconds > 0;

  useEffect(() => {
    if (!autoVerify || isCoolingDown || hasStarted.current) {
      return;
    }

    hasStarted.current = true;
    formRef.current?.requestSubmit();
  }, [autoVerify, isCoolingDown]);

  return (
    <form ref={formRef} action={verifyConsultationSlipAction} className="mt-6 rounded-[22px] border border-teal-200/80 bg-white/80 p-5 shadow-[0_10px_26px_rgba(0,96,103,0.05)]">
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
      {autoVerify ? (
        <VerificationProgress />
      ) : isCoolingDown ? (
        <p className="mt-4 text-xs font-semibold leading-5 text-[#3e494a]">
          ตรวจสอบซ้ำได้อีกในประมาณ {retryAfterSeconds} วินาที
        </p>
      ) : (
        <VerifyButton />
      )}
    </form>
  );
}

function VerificationProgress() {
  const { pending } = useFormStatus();

  return (
    <div aria-live="polite" className="mt-5 flex flex-col items-center gap-2 rounded-[18px] bg-teal-50/70 px-4 py-5 text-center text-primary">
      <Loader2 aria-hidden="true" className="size-7 animate-spin" />
      <p className="text-sm font-extrabold">กรุณารอสักครู่</p>
      <p className="text-xs leading-5 text-[#3e494a]">
        {pending ? "กำลังตรวจสอบสลิปและยืนยันนัดหมาย" : "กำลังเริ่มตรวจสอบสลิป"}
      </p>
    </div>
  );
}

function VerifyButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-gradient text-sm font-extrabold text-white shadow-[0_12px_24px_-8px_rgba(0,96,103,0.4)] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="size-4" strokeWidth={2.25} />}
      {pending ? "กรุณารอสักครู่" : "ตรวจสอบสลิปอัตโนมัติ"}
    </button>
  );
}
