"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ConsultationPrescriptionOutcomeStatus } from "@prisma/client";
import {
  updatePrescriptionOutcomeAction,
  type DoctorPrescriptionOutcomeActionState
} from "@/features/doctor/consultations/actions";
import { prescriptionOutcomeLabels } from "@/features/prescriptions/outcome";
import { cn } from "@/lib/design-system/variants";

const initialState: DoctorPrescriptionOutcomeActionState = {
  status: "idle",
  message: ""
};

const outcomeOptions = [
  "pending_doctor_summary",
  "prescription_issued",
  "no_prescription"
] as const satisfies readonly ConsultationPrescriptionOutcomeStatus[];

export function DoctorPrescriptionOutcomeForm({
  consultationId,
  currentStatus
}: {
  consultationId: string;
  currentStatus: ConsultationPrescriptionOutcomeStatus;
}) {
  const [state, formAction] = useActionState(updatePrescriptionOutcomeAction, initialState);

  return (
    <form action={formAction} className="mt-4 rounded-[8px] border border-primary/15 bg-primary/5 p-3">
      <input type="hidden" name="consultationId" value={consultationId} />
      <label htmlFor={`prescription-outcome-${consultationId}`} className="block">
        <span className="text-xs font-bold text-text">ผลสรุปใบสั่งยาหลังการปรึกษา</span>
        <select
          key={currentStatus}
          id={`prescription-outcome-${consultationId}`}
          name="prescriptionOutcomeStatus"
          defaultValue={currentStatus}
          className="mt-2 min-h-10 w-full rounded-[8px] border border-border bg-white/90 px-3 text-sm text-text outline-none transition focus:border-primary"
        >
          {outcomeOptions.map((status) => (
            <option key={status} value={status}>
              {prescriptionOutcomeLabels[status]}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p
          role="status"
          className={cn(
            "text-[11px] font-semibold leading-4",
            state.status === "success" ? "text-success" : state.status === "error" ? "text-danger" : "text-muted"
          )}
        >
          {state.message || "สถานะ “มีใบสั่งยา” ใช้ได้เมื่อมีใบสั่งยาจริงในระบบเท่านั้น"}
        </p>
        <OutcomeSubmitButton />
      </div>
    </form>
  );
}

function OutcomeSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-9 shrink-0 rounded-full bg-primary px-4 text-xs font-bold text-white disabled:opacity-60"
    >
      {pending ? "กำลังบันทึก" : "บันทึกผล"}
    </button>
  );
}
