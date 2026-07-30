"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Video } from "lucide-react";
import {
  transitionDoctorConsultationAction,
  type DoctorConsultationWorkflowActionState
} from "@/features/doctor/consultations/workflow-actions";
import { cn } from "@/lib/design-system/variants";
import type { DoctorConsultationItem } from "@/features/doctor/consultations/types";

const initialState: DoctorConsultationWorkflowActionState = {
  status: "idle",
  message: ""
};

export function DoctorConsultationControls({
  consultation
}: {
  consultation: Pick<DoctorConsultationItem, "id" | "status" | "summary">;
}) {
  const [state, formAction] = useActionState(transitionDoctorConsultationAction, initialState);

  if (consultation.status !== "scheduled" && consultation.status !== "live") {
    return null;
  }

  const isCompleting = consultation.status === "live";

  return (
    <form action={formAction} className="mt-4 rounded-[8px] border border-primary/15 bg-white/70 p-3">
      <input type="hidden" name="consultationId" value={consultation.id} />
      <input type="hidden" name="transition" value={isCompleting ? "complete" : "start"} />
      {isCompleting ? (
        <>
          <label htmlFor={`summary-${consultation.id}`} className="text-[10px] font-bold uppercase text-muted">
            สรุปการปรึกษาก่อนจบ
          </label>
          <textarea
            id={`summary-${consultation.id}`}
            name="summary"
            defaultValue={consultation.summary ?? ""}
            className="mt-2 min-h-24 w-full resize-none rounded-[8px] border border-border bg-white px-3 py-2 text-sm leading-5 text-text outline-none transition focus:border-primary"
            placeholder="สรุปอาการ การวินิจฉัยเบื้องต้น คำแนะนำ และการติดตาม"
          />
        </>
      ) : (
        <p className="text-xs leading-5 text-muted">เริ่มสถานะ consult และสร้างห้อง Zoom อัตโนมัติเมื่อกำหนด credentials แล้ว</p>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <p
          role="status"
          className={cn(
            "text-[11px] font-semibold leading-4",
            state.status === "success" ? "text-success" : state.status === "error" ? "text-danger" : "text-muted"
          )}
        >
          {state.message}
        </p>
        <WorkflowSubmitButton complete={isCompleting} />
      </div>
    </form>
  );
}

function WorkflowSubmitButton({ complete }: { complete: boolean }) {
  const { pending } = useFormStatus();
  const Icon = complete ? CheckCircle2 : Video;

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-white disabled:opacity-60"
    >
      <Icon aria-hidden="true" className="size-4" strokeWidth={2.1} />
      {pending ? "กำลังบันทึก" : complete ? "จบการปรึกษา" : "เริ่มการปรึกษา"}
    </button>
  );
}
