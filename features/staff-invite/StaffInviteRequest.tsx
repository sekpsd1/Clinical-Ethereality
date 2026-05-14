"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { requestStaffInviteAction, type StaffInviteActionState } from "@/features/staff-invite/actions";
import type { StaffInviteRole } from "@/features/staff-invite/schema";
import { cn } from "@/lib/design-system/variants";

const roleLabels: Record<StaffInviteRole, string> = {
  admin: "ผู้ดูแลระบบ",
  doctor: "แพทย์",
  pharmacist: "เภสัชกร"
};

const roleHelp: Record<StaffInviteRole, string> = {
  admin: "ใช้สำหรับทีมปฏิบัติการที่ต้องเข้าหน้าแอดมิน หลังส่งคำขอแล้วต้องรอผู้ดูแลระบบเดิมอนุมัติ",
  doctor: "ใช้สำหรับแพทย์ที่ต้องรับ consultation เขียนคำแนะนำ และออกใบสั่งยา",
  pharmacist: "ใช้สำหรับเภสัชกรที่ต้องตรวจใบสั่งยา เตรียมยา และอัปเดตสถานะจัดส่ง"
};

const initialState: StaffInviteActionState = {
  status: "idle",
  message: ""
};

export function StaffInviteRequest({
  role,
  displayName,
  currentStatus
}: {
  role: StaffInviteRole;
  displayName: string;
  currentStatus: string;
}) {
  const [state, action] = useActionState(requestStaffInviteAction, initialState);

  return (
    <main className="min-h-dvh bg-app px-4 py-[calc(1.5rem+env(safe-area-inset-top))] text-text">
      <section className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-mobile flex-col gap-5">
        <div className="rounded-[24px] bg-primary-gradient p-5 text-white shadow-booking">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-label font-bold uppercase text-white/75">คำเชิญบุคลากร</p>
              <h1 className="mt-1 font-headline text-2xl font-bold">ขอสิทธิ์{roleLabels[role]}</h1>
              <p className="mt-3 text-sm leading-6 text-white/80">{roleHelp[role]}</p>
            </div>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15">
              <ShieldCheck aria-hidden="true" className="size-6" strokeWidth={2.1} />
            </span>
          </div>
        </div>

        <section className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
          <p className="text-label font-bold uppercase text-primary">บัญชี LINE</p>
          <h2 className="mt-1 text-lg font-bold text-text">{displayName}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            สถานะปัจจุบัน: {currentStatus}. เมื่อส่งคำขอแล้ว แอดมินจะเห็นรายการนี้ในหน้าอนุมัติผู้ใช้
          </p>
        </section>

        <form action={action} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
          <input type="hidden" name="role" value={role} />
          <div className="flex flex-col gap-4">
            {role !== "admin" ? (
              <label className="flex flex-col gap-2 text-sm font-bold text-text">
                เลขใบประกอบวิชาชีพ
                <input
                  name="licenseNumber"
                  placeholder={role === "doctor" ? "เช่น ว.12345" : "เช่น ภ.12345"}
                  className="min-h-11 rounded-[8px] border border-border bg-white px-3 text-sm font-normal text-text outline-none focus:border-primary"
                />
              </label>
            ) : null}

            {role === "doctor" ? (
              <label className="flex flex-col gap-2 text-sm font-bold text-text">
                ความเชี่ยวชาญ
                <input
                  name="specialty"
                  placeholder="เช่น ผิวหนังและความงาม"
                  className="min-h-11 rounded-[8px] border border-border bg-white px-3 text-sm font-normal text-text outline-none focus:border-primary"
                />
              </label>
            ) : null}

            {role === "pharmacist" ? (
              <label className="flex flex-col gap-2 text-sm font-bold text-text">
                ร้านยา
                <input
                  name="pharmacyName"
                  placeholder="ชื่อร้านยาที่สังกัด"
                  className="min-h-11 rounded-[8px] border border-border bg-white px-3 text-sm font-normal text-text outline-none focus:border-primary"
                />
              </label>
            ) : null}

            <SubmitButton />
          </div>

          {state.status !== "idle" ? (
            <p
              role="status"
              className={cn(
                "mt-4 rounded-[8px] px-3 py-2 text-sm font-semibold leading-6",
                state.status === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
              )}
            >
              {state.message}
            </p>
          ) : null}
        </form>
      </section>
    </main>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white shadow-chip disabled:opacity-60"
    >
      <CheckCircle2 aria-hidden="true" className="size-4" strokeWidth={2.1} />
      {pending ? "กำลังส่งคำขอ..." : "ส่งคำขอให้แอดมินตรวจ"}
    </button>
  );
}
