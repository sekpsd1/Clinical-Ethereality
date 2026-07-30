"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { SendHorizontal } from "lucide-react";
import { submitPrescriptionAction } from "@/features/doctor/consultations/actions";
import { cn } from "@/lib/design-system/variants";
import type { DoctorPrescriptionActionState } from "@/features/doctor/consultations/actions";
import type { DoctorConsultationItem } from "@/features/doctor/consultations/types";

type DoctorPrescriptionFormProps = {
  consultation: Pick<
    DoctorConsultationItem,
    "id" | "latestPrescriptionMedication" | "latestPrescriptionNotes" | "latestPrescriptionStatus"
  >;
};

const initialActionState: DoctorPrescriptionActionState = {
  status: "idle",
  message: ""
};

export function DoctorPrescriptionForm({ consultation }: DoctorPrescriptionFormProps) {
  const [state, formAction] = useActionState(submitPrescriptionAction, initialActionState);
  const defaultNotes =
    consultation.latestPrescriptionStatus === "draft" || consultation.latestPrescriptionStatus === "rejected"
      ? consultation.latestPrescriptionNotes ?? ""
      : "";
  const defaultMedication =
    consultation.latestPrescriptionStatus === "draft" || consultation.latestPrescriptionStatus === "rejected"
      ? consultation.latestPrescriptionMedication
      : null;

  return (
    <form action={formAction} className="mt-4 rounded-[8px] bg-primary/5 p-3">
      <input type="hidden" name="consultationId" value={consultation.id} />
      <p className="text-[10px] font-bold uppercase text-muted">
        รายการยา
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <PrescriptionField
          id={`medication-${consultation.id}`}
          label="ชื่อยา"
          name="medicationName"
          defaultValue={defaultMedication?.medicationName}
          className="col-span-2"
        />
        <PrescriptionField
          id={`dosage-${consultation.id}`}
          label="ขนาดยา"
          name="dosage"
          defaultValue={defaultMedication?.dosage}
        />
        <PrescriptionField
          id={`quantity-${consultation.id}`}
          label="จำนวน"
          name="quantity"
          defaultValue={defaultMedication?.quantity}
        />
      </div>
      <label className="mt-3 block text-[10px] font-bold uppercase text-muted" htmlFor={`instructions-${consultation.id}`}>
        วิธีใช้
      </label>
      <textarea
        id={`instructions-${consultation.id}`}
        name="instructions"
        defaultValue={defaultMedication?.instructions}
        className="mt-2 min-h-20 w-full resize-none rounded-[8px] border border-border bg-white/85 px-3 py-2 text-sm leading-5 text-text outline-none transition focus:border-primary"
        placeholder="เช่น รับประทานครั้งละ 1 เม็ด หลังอาหาร วันละ 2 ครั้ง"
      />
      <label className="mt-3 block text-[10px] font-bold uppercase text-muted" htmlFor={`warnings-${consultation.id}`}>
        คำเตือน
      </label>
      <textarea
        id={`warnings-${consultation.id}`}
        name="warnings"
        defaultValue={defaultMedication?.warnings}
        className="mt-2 min-h-16 w-full resize-none rounded-[8px] border border-border bg-white/85 px-3 py-2 text-sm leading-5 text-text outline-none transition focus:border-primary"
        placeholder="ข้อควรระวัง อาการแพ้ หรือเงื่อนไขที่ต้องหยุดยา"
      />
      <label className="mt-3 block text-[10px] font-bold uppercase text-muted" htmlFor={`prescription-${consultation.id}`}>
        บันทึกเพิ่มเติม
      </label>
      <textarea
        id={`prescription-${consultation.id}`}
        name="notes"
        defaultValue={defaultNotes}
        className="mt-2 min-h-24 w-full resize-none rounded-[8px] border border-border bg-white/85 px-3 py-2 text-sm leading-5 text-text outline-none transition focus:border-primary"
        placeholder="คำแนะนำติดตามอาการหรือหมายเหตุทางคลินิก"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p
          className={cn(
            "min-w-0 text-[11px] font-semibold leading-4",
            state.status === "success" ? "text-success" : state.status === "error" ? "text-danger" : "text-muted"
          )}
          role="status"
        >
          {state.message || "ออกใบสั่งยาให้ลูกค้านำไปสั่งซื้อได้ทันที"}
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}

function PrescriptionField({
  id,
  label,
  name,
  defaultValue,
  className
}: {
  id: string;
  label: string;
  name: string;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <label htmlFor={id} className={className}>
      <span className="text-[10px] font-bold uppercase text-muted">{label}</span>
      <input
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="mt-1 min-h-10 w-full rounded-[8px] border border-border bg-white/85 px-3 text-sm text-text outline-none transition focus:border-primary"
      />
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-60"
      aria-label="ส่งใบสั่งยา"
      disabled={pending}
    >
      <SendHorizontal aria-hidden="true" className="size-4" strokeWidth={2.1} />
    </button>
  );
}
