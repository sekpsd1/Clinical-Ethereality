"use client";

import { useActionState } from "react";
import { BadgeDollarSign } from "lucide-react";
import { updateConsultationFeeAction, type AdminConsultationFeeActionState } from "@/features/admin/consultation-fees/actions";
import type { AdminDoctorOption } from "@/features/admin/schedules/types";

const initialState: AdminConsultationFeeActionState = {
  status: "idle",
  message: ""
};

export function AdminConsultationFeeSettings({ doctors }: { doctors: AdminDoctorOption[] }) {
  return (
    <section className="space-y-3">
      <div className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
            <BadgeDollarSign aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="font-headline text-lg font-bold text-text">ค่าปรึกษาแพทย์</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              ระบบการจองและชำระเงินอ่านค่าปัจจุบันจากเซิร์ฟเวอร์ การแก้ไขจึงอาจมีผลต่อรายการที่ยังรอชำระ กรุณาตรวจสอบจำนวนเงินก่อนบันทึก
            </p>
          </div>
        </div>
      </div>

      {doctors.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center text-xs font-semibold text-muted">
          ยังไม่มีแพทย์ที่อนุมัติแล้วสำหรับตั้งค่าปรึกษา
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {doctors.map((doctor) => (
          <AdminDoctorConsultationFeeForm key={`${doctor.id}:${doctor.updatedAtIso}`} doctor={doctor} />
        ))}
      </div>
    </section>
  );
}
function AdminDoctorConsultationFeeForm({ doctor }: { doctor: AdminDoctorOption }) {
  const [state, action, isPending] = useActionState(updateConsultationFeeAction, initialState);
  const isDisabled = isPending || !doctor.feeEligible;

  return (
    <form action={action} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      <input type="hidden" name="doctorId" value={doctor.id} />
      <input type="hidden" name="expectedUpdatedAt" value={doctor.updatedAtIso} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-text">{doctor.name}</h3>
          <p className="mt-1 truncate text-xs font-semibold text-muted">{doctor.specialty}</p>
        </div>
        <p className="shrink-0 text-sm font-bold text-primary">{doctor.consultationFeeLabel}</p>
      </div>

      <label className="mt-4 block">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">ค่าปรึกษา (บาท)</span>
        <input
          aria-label={`ค่าปรึกษา ${doctor.name}`}
          name="consultationFee"
          type="text"
          inputMode="decimal"
          pattern="[0-9]+\.[0-9]{2}"
          placeholder="700.00"
          defaultValue={doctor.consultationFeeInput}
          disabled={isDisabled}
          required
          className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-base font-semibold text-text outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted"
        />
        <span className="mt-1 block text-[11px] leading-5 text-muted">ช่วง 1.00–100,000.00 บาท และต้องลงท้าย .00</span>
      </label>

      {!doctor.feeEligible ? (
        <p className="mt-3 rounded-[8px] bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
          บัญชีแพทย์ไม่ได้อยู่ในสถานะใช้งาน จึงยังปรับค่าปรึกษาไม่ได้
        </p>
      ) : null}

      {state.status !== "idle" ? (
        <p
          className={`mt-3 rounded-[8px] px-3 py-2 text-xs font-semibold ${
            state.status === "success" ? "bg-primary/10 text-primary" : "bg-[#ba1a1a]/10 text-[#93000a]"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isDisabled}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary-gradient px-5 text-sm font-bold text-white shadow-payment-active disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {isPending ? "กำลังบันทึก..." : "บันทึกค่าปรึกษา"}
      </button>
    </form>
  );
}
