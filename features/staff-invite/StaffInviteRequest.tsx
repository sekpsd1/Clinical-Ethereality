"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, FileCheck2, ImageUp, ShieldCheck } from "lucide-react";
import { requestStaffInviteAction, type StaffInviteActionState } from "@/features/staff-invite/actions";
import type { StaffInviteRole } from "@/features/staff-invite/schema";
import { staffFileAccept } from "@/features/staff-files/types";
import { doctorSpecialtyChoices } from "@/features/staff-invite/doctor-specialties";
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
  currentStatus,
  requestStatus
}: {
  role: StaffInviteRole;
  displayName: string;
  currentStatus: string;
  requestStatus?: string;
}) {
  const [state, action] = useActionState(requestStaffInviteAction, initialState);
  const submitted = state.status === "success" || requestStatus === "pending_review";
  const approved = requestStatus === "approved";

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

        {submitted || approved ? (
          <section className="rounded-[8px] border border-border bg-white/90 p-5 text-center shadow-payment-card">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 aria-hidden="true" className="size-7" strokeWidth={2.1} />
            </span>
            <h2 className="mt-4 font-headline text-xl font-bold text-text">
              {approved ? `อนุมัติสิทธิ์${roleLabels[role]}แล้ว` : "ส่งคำขอเรียบร้อยแล้ว"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {approved
                ? "กรุณาออกจากระบบแล้วเปิดแอปผ่าน LINE อีกครั้ง เพื่อเริ่มใช้งานด้วยสิทธิ์ใหม่"
                : `คำขอสิทธิ์${roleLabels[role]}อยู่ระหว่างการตรวจสอบ ผู้ดูแลระบบจะตรวจเอกสารและเปิดสิทธิ์ให้เมื่อข้อมูลครบถ้วน`}
            </p>
            {!approved ? (
              <p className="mt-3 rounded-[8px] bg-primary/5 px-3 py-2 text-xs font-semibold leading-5 text-primary">
                เมื่อตรวจสอบเสร็จ ระบบจะแจ้งผลในศูนย์การแจ้งเตือน
              </p>
            ) : null}
          </section>
        ) : (
          <form action={action} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
          <input type="hidden" name="role" value={role} />
          <div className="flex flex-col gap-4">
            {role !== "admin" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-bold text-text">
                  ชื่อ
                  <input
                    name="firstName"
                    autoComplete="given-name"
                    required
                    placeholder="ชื่อจริง"
                    className="min-h-11 rounded-[8px] border border-border bg-white px-3 text-sm font-normal text-text outline-none focus:border-primary"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-bold text-text">
                  นามสกุล
                  <input
                    name="lastName"
                    autoComplete="family-name"
                    required
                    placeholder="นามสกุล"
                    className="min-h-11 rounded-[8px] border border-border bg-white px-3 text-sm font-normal text-text outline-none focus:border-primary"
                  />
                </label>
              </div>
            ) : null}

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
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-bold text-text">ความเชี่ยวชาญ</legend>
                <p className="text-xs leading-5 text-muted">เลือกได้ไม่เกิน 3 รายการ</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {doctorSpecialtyChoices.map((choice) => (
                    <label
                      key={choice.value}
                      className="flex min-h-11 items-center gap-3 rounded-[8px] border border-border bg-white px-3 py-2 text-sm font-semibold text-text"
                    >
                      <input
                        type="checkbox"
                        name="specialties"
                        value={choice.value}
                        className="size-4 accent-primary"
                      />
                      <span>{choice.label}</span>
                    </label>
                  ))}
                </div>
                <label className="flex flex-col gap-2 text-sm font-bold text-text">
                  ระบุความเชี่ยวชาญอื่น ๆ
                  <input
                    name="otherSpecialty"
                    placeholder="กรอกเมื่อเลือก อื่น ๆ"
                    className="min-h-11 rounded-[8px] border border-border bg-white px-3 text-sm font-normal text-text outline-none focus:border-primary"
                  />
                </label>
              </fieldset>
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

            {role !== "admin" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-bold text-text">
                  <span className="inline-flex items-center gap-2">
                    <ImageUp aria-hidden="true" className="size-4 text-primary" />
                    รูปโปรไฟล์ทางการ
                  </span>
                  <input
                    type="file"
                    name="profilePhoto"
                    accept={staffFileAccept.profilePhoto}
                    required
                    className="min-h-11 rounded-[8px] border border-border bg-white px-3 py-2 text-xs font-normal text-text file:mr-3 file:rounded-full file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:font-bold file:text-primary"
                  />
                  <span className="text-xs font-normal leading-5 text-muted">JPG, PNG หรือ WEBP ไม่เกิน 5 MB</span>
                </label>
                <label className="flex flex-col gap-2 text-sm font-bold text-text">
                  <span className="inline-flex items-center gap-2">
                    <FileCheck2 aria-hidden="true" className="size-4 text-primary" />
                    เอกสารใบอนุญาต
                  </span>
                  <input
                    type="file"
                    name="licenseProof"
                    accept={staffFileAccept.licenseProof}
                    required
                    className="min-h-11 rounded-[8px] border border-border bg-white px-3 py-2 text-xs font-normal text-text file:mr-3 file:rounded-full file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:font-bold file:text-primary"
                  />
                  <span className="text-xs font-normal leading-5 text-muted">PDF, JPG, PNG หรือ WEBP ไม่เกิน 10 MB</span>
                </label>
              </div>
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
        )}
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
