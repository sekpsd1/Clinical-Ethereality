"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import type { PatientVerificationStatus } from "@/features/identity-verification/service";

type ApiResult = { ok: boolean; message?: string; challengeId?: string; phoneLabel?: string; alreadyVerified?: true };

async function postJson(url: string, body: Record<string, string>): Promise<ApiResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  return (await response.json().catch(() => ({ ok: false, message: "ยังไม่สามารถดำเนินการได้" }))) as ApiResult;
}

export function BookingIdentityVerification({ status }: { status: PatientVerificationStatus }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(status.fullName ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(status.dateOfBirth ?? "");
  const [phone, setPhone] = useState(status.phone ?? "");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [phoneLabel, setPhoneLabel] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function requestOtp() {
    setPending(true);
    setMessage(null);
    try {
      const result = await postJson("/api/identity/phone-otp/request", { fullName, dateOfBirth, phone });
      if (!result.ok) {
        setMessage(result.message ?? "ยังไม่สามารถส่งรหัสได้");
        return;
      }
      if (result.alreadyVerified) {
        router.refresh();
        return;
      }
      setChallengeId(result.challengeId ?? null);
      setPhoneLabel(result.phoneLabel ?? null);
      setMessage("ส่งรหัส OTP แล้ว กรุณากรอกรหัสเพื่อยืนยันเบอร์โทร");
    } catch {
      setMessage("ยังไม่สามารถขอรหัสได้ กรุณาลองใหม่");
    } finally {
      setPending(false);
    }
  }

  async function verifyOtp() {
    if (!challengeId) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await postJson("/api/identity/phone-otp/verify", { challengeId, code });
      if (!result.ok) {
        setMessage(result.message ?? "ยืนยันรหัสไม่สำเร็จ");
        return;
      }
      setMessage("ยืนยันเบอร์โทรแล้ว กำลังเปิดการจอง");
      router.refresh();
    } catch {
      setMessage("ยังไม่สามารถยืนยันรหัสได้ กรุณาลองใหม่");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="booking-identity-title" className="rounded-[24px] border border-primary/15 bg-white/75 p-5 shadow-payment-card">
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck aria-hidden="true" className="size-5" strokeWidth={2.2} />
        </span>
        <div>
          <h2 id="booking-identity-title" className="text-base font-extrabold text-text">ยืนยันข้อมูลก่อนจองแพทย์</h2>
          <p className="mt-1 text-xs leading-5 text-muted">กรอกชื่อ-นามสกุล วันเกิด และยืนยันเบอร์มือถือด้วย SMS OTP เพื่อจองครั้งแรก</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="text-xs font-bold text-text">ชื่อ-นามสกุล
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-medium outline-none focus:border-primary" />
        </label>
        <label className="text-xs font-bold text-text">วันเดือนปีเกิด
          <input value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} type="date" max={new Date().toISOString().slice(0, 10)} autoComplete="bday" className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-medium outline-none focus:border-primary" />
        </label>
        <label className="text-xs font-bold text-text">เบอร์มือถือ
          <input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="0812345678" className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-medium outline-none focus:border-primary" />
        </label>
      </div>

      {challengeId ? (
        <div className="mt-4 rounded-[16px] bg-primary/5 p-3">
          <label className="text-xs font-bold text-text">รหัส OTP {phoneLabel ? `สำหรับ ${phoneLabel}` : ""}
            <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-medium outline-none focus:border-primary" />
          </label>
          <button type="button" disabled={pending || code.length < 4} onClick={verifyOtp} className="mt-3 flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-bold text-white disabled:opacity-50">
            {pending ? "กำลังยืนยัน..." : "ยืนยันรหัส OTP"}
          </button>
        </div>
      ) : (
        <button type="button" disabled={pending} onClick={requestOtp} className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-bold text-white disabled:opacity-50">
          {pending ? "กำลังขอรหัส..." : "ขอรหัส SMS OTP"}
        </button>
      )}

      {message ? <p role="status" className="mt-3 text-xs font-semibold leading-5 text-muted">{message}</p> : null}
      <p className="mt-3 text-[11px] leading-5 text-muted">OTP ยืนยันเพียงการเข้าถึงบัญชี LINE และเบอร์โทรนี้ ไม่ใช่การพิสูจน์ตัวตนตามเอกสาร</p>
    </section>
  );
}
