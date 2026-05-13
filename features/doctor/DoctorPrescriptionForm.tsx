"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { SendHorizontal } from "lucide-react";
import { submitPrescriptionAction } from "@/features/doctor/consultations/actions";
import { cn } from "@/lib/design-system/variants";
import type { DoctorPrescriptionActionState } from "@/features/doctor/consultations/actions";
import type { DoctorConsultationItem } from "@/features/doctor/consultations/types";

type DoctorPrescriptionFormProps = {
  consultation: Pick<DoctorConsultationItem, "id" | "latestPrescriptionNotes" | "latestPrescriptionStatus">;
};

const initialActionState: DoctorPrescriptionActionState = {
  status: "idle",
  message: ""
};

export function DoctorPrescriptionForm({ consultation }: DoctorPrescriptionFormProps) {
  const [state, formAction] = useActionState(submitPrescriptionAction, initialActionState);
  const defaultNotes = consultation.latestPrescriptionStatus === "draft" || consultation.latestPrescriptionStatus === "rejected"
    ? consultation.latestPrescriptionNotes ?? ""
    : "";

  return (
    <form action={formAction} className="mt-4 rounded-[8px] bg-primary/5 p-3">
      <input type="hidden" name="consultationId" value={consultation.id} />
      <label className="text-[10px] font-bold uppercase text-muted" htmlFor={`prescription-${consultation.id}`}>
        Prescription note
      </label>
      <textarea
        id={`prescription-${consultation.id}`}
        name="notes"
        defaultValue={defaultNotes}
        className="mt-2 min-h-24 w-full resize-none rounded-[8px] border border-border bg-white/85 px-3 py-2 text-sm leading-5 text-text outline-none transition focus:border-primary"
        placeholder="Medication, dose, usage instructions, and warnings for pharmacist verification"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p
          className={cn(
            "min-w-0 text-[11px] font-semibold leading-4",
            state.status === "success" ? "text-success" : state.status === "error" ? "text-danger" : "text-muted"
          )}
          role="status"
        >
          {state.message || "Submits to pharmacist verification."}
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-60"
      aria-label="Submit prescription"
      disabled={pending}
    >
      <SendHorizontal aria-hidden="true" className="size-4" strokeWidth={2.1} />
    </button>
  );
}
