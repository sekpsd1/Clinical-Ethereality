"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircle2, Save, Stethoscope } from "lucide-react";
import {
  manageDoctorProfileAction,
  type ManageDoctorProfileActionState
} from "@/features/admin/users/doctor-profile-actions";
import { cn } from "@/lib/design-system/variants";

const initialState: ManageDoctorProfileActionState = {
  status: "idle",
  message: ""
};

export function AdminDoctorProfileForm({
  userId,
  accountName,
  fullName,
  specialty,
  licenseNumber,
  bio,
  approved
}: {
  userId: string;
  accountName: string;
  fullName: string | null;
  specialty: string | null;
  licenseNumber: string | null;
  bio: string | null;
  approved: boolean;
}) {
  const router = useRouter();
  const [state, action] = useActionState(manageDoctorProfileAction, initialState);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form action={action} className="mt-4 rounded-[8px] border border-primary/20 bg-primary/[0.035] p-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex items-start gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Stethoscope aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h4 className="text-xs font-bold text-text">ข้อมูลแพทย์ที่ผู้ดูแลระบบยืนยัน</h4>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-muted">
            ชื่อจาก LINE ของบัญชีนี้คือ {accountName}. กรุณาใช้ชื่อจริงทางวิชาชีพในฟอร์มด้านล่าง
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <DoctorField label="ชื่อ-นามสกุลจริง" name="fullName" defaultValue={fullName ?? ""} maxLength={191} />
        <DoctorField label="สาขาความถนัด" name="specialty" defaultValue={specialty ?? ""} maxLength={191} />
        <DoctorField
          label="เลขที่ใบประกอบวิชาชีพ"
          name="licenseNumber"
          defaultValue={licenseNumber ?? ""}
          maxLength={191}
        />
        <label className="flex flex-col gap-1.5 text-xs font-bold text-text md:col-span-2">
          ประวัติ / คำแนะนำแพทย์
          <textarea
            name="bio"
            defaultValue={bio ?? ""}
            maxLength={4_000}
            rows={3}
            className="min-h-24 rounded-[8px] border border-border bg-white px-3 py-2 text-sm font-normal leading-6 text-text outline-none focus:border-primary"
          />
        </label>
      </div>

      <p className="mt-3 rounded-[8px] bg-white/80 px-3 py-2 text-[11px] font-semibold leading-5 text-muted">
        ต้องอัปโหลดรูปโปรไฟล์ทางการและเอกสารใบอนุญาตให้ครบก่อนอนุมัติ ค่าปรึกษาและตารางแพทย์จัดการในหน้าตารางแพทย์ตามเดิม
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <DoctorSubmitButton intent="save" label="บันทึกข้อมูล" icon="save" />
        <DoctorSubmitButton
          intent="approve"
          label={approved ? "ยืนยันข้อมูลอีกครั้ง" : "บันทึกและอนุมัติแพทย์"}
          icon="approve"
        />
      </div>

      {state.status !== "idle" ? (
        <p
          role="status"
          className={cn(
            "mt-3 text-[11px] font-semibold leading-5",
            state.status === "success" ? "text-success" : "text-danger"
          )}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function DoctorField({
  label,
  name,
  defaultValue,
  maxLength
}: {
  label: string;
  name: string;
  defaultValue: string;
  maxLength: number;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-bold text-text">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        maxLength={maxLength}
        required
        className="h-11 rounded-[8px] border border-border bg-white px-3 text-sm font-normal text-text outline-none focus:border-primary"
      />
    </label>
  );
}

function DoctorSubmitButton({
  intent,
  label,
  icon
}: {
  intent: "save" | "approve";
  label: string;
  icon: "save" | "approve";
}) {
  const { pending } = useFormStatus();
  const Icon = icon === "save" ? Save : CheckCircle2;

  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      disabled={pending}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] px-4 text-xs font-bold disabled:opacity-60",
        intent === "approve"
          ? "bg-primary text-white"
          : "border border-primary/20 bg-white text-primary"
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {pending ? "กำลังบันทึก" : label}
    </button>
  );
}
