"use client";

import Link from "next/link";
import type { Route } from "next";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, CheckCircle2, Clock3, UserRoundX, Video } from "lucide-react";
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
  consultation: Pick<DoctorConsultationItem, "id" | "status" | "summary" | "attendance">;
}) {
  const [state, formAction] = useActionState(transitionDoctorConsultationAction, initialState);

  if (consultation.status !== "scheduled" && consultation.status !== "live") {
    return null;
  }

  const isCompleting = consultation.status === "live";
  const canCompleteNormally = isCompleting && consultation.attendance.normalCompletionEligible;
  const canCompleteNoShow = isCompleting && consultation.attendance.noShowCompletionEligible;
  const transition = !isCompleting
    ? "start"
    : canCompleteNormally
      ? "complete"
      : canCompleteNoShow
        ? "complete_no_show"
        : null;

  return (
    <form
      action={formAction}
      className="mt-4 rounded-[8px] border border-primary/15 bg-white/70 p-3"
      onSubmit={(event) => {
        if (
          transition === "complete" &&
          !window.confirm(
            "ยืนยันว่าการปรึกษาเสร็จสิ้นจริงและต้องการปิดห้องนี้ใช่ไหม? การดำเนินการนี้เป็นขั้นตอนสุดท้าย"
          )
        ) {
          event.preventDefault();
        }

        if (
          transition === "complete_no_show" &&
          !window.confirm(
            "ยืนยันว่าผู้ป่วยไม่ได้เข้าห้อง Zoom และต้องการบันทึกผลไม่มาตามนัดใช่ไหม? ระบบจะแจ้งผู้ป่วยและไม่สร้างคำแนะนำทางคลินิก"
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="consultationId" value={consultation.id} />
      {transition ? <input type="hidden" name="transition" value={transition} /> : null}
      {isCompleting ? (
        <>
          <div className="rounded-[8px] border border-primary/10 bg-primary/5 p-3">
            <p className="text-xs font-bold text-primary">{consultation.attendance.label}</p>
            <p className="mt-1 text-[11px] font-semibold leading-5 text-muted">
              {consultation.attendance.description}
            </p>
          </div>
          {canCompleteNormally ? (
            <>
              <label htmlFor={`summary-${consultation.id}`} className="mt-3 block text-[10px] font-bold uppercase text-muted">
                สรุปการปรึกษาก่อนจบ
              </label>
              <textarea
                id={`summary-${consultation.id}`}
                name="summary"
                defaultValue={consultation.summary ?? ""}
                className="mt-2 min-h-24 w-full resize-none rounded-[8px] border border-border bg-white px-3 py-2 text-sm leading-5 text-text outline-none transition focus:border-primary"
                placeholder="สรุปอาการ การวินิจฉัยเบื้องต้น คำแนะนำ และการติดตาม"
                required
                minLength={5}
              />
              <p className="mt-2 text-[11px] font-semibold leading-5 text-danger">
                กดจบการปรึกษาหลังออกจากห้องและให้คำแนะนำผู้ป่วยครบแล้วเท่านั้น
              </p>
            </>
          ) : canCompleteNoShow ? (
            <>
              <label htmlFor={`no-show-reason-${consultation.id}`} className="mt-3 block text-[10px] font-bold uppercase text-muted">
                เหตุผลที่ระบบอนุญาต
              </label>
              <select
                id={`no-show-reason-${consultation.id}`}
                name="noShowReason"
                defaultValue="customer_did_not_join"
                className="mt-2 min-h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text"
                required
              >
                <option value="customer_did_not_join">ผู้ป่วยไม่เข้าห้อง Zoom หลังแพทย์รอครบ 10 นาที</option>
              </select>
              <p className="mt-2 text-[11px] font-semibold leading-5 text-danger">
                การบันทึกนี้ไม่ใช่คำแนะนำทางคลินิก และระบบจะไม่ระบุว่าผู้ป่วยเข้าร่วม
              </p>
            </>
          ) : (
            <p className="mt-3 flex items-start gap-2 text-[11px] font-semibold leading-5 text-muted">
              <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              ปุ่มจบจะเปิดเมื่อ Zoom ยืนยันผู้เข้าร่วมครบ หรือยืนยันช่วงเวลารอของแพทย์ครบตามกติกา
            </p>
          )}
        </>
      ) : (
        <p className="text-xs leading-5 text-muted">เริ่มสถานะ consult และสร้างห้อง Zoom อัตโนมัติเมื่อกำหนด credentials แล้ว</p>
      )}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          role="status"
          className={cn(
            "text-[11px] font-semibold leading-4",
            state.status === "success" ? "text-success" : state.status === "error" ? "text-danger" : "text-muted"
          )}
        >
          {state.message}
        </p>
        {state.status === "success" && state.roomHref ? (
          <Link
            href={state.roomHref as Route}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-white shadow-payment-active"
          >
            <Video aria-hidden="true" className="size-4" strokeWidth={2.1} />
            เข้าห้องปรึกษา/Zoom ตอนนี้
            <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2.1} />
          </Link>
        ) : (
          transition ? <WorkflowSubmitButton transition={transition} /> : null
        )}
      </div>
    </form>
  );
}

function WorkflowSubmitButton({
  transition
}: {
  transition: "start" | "complete" | "complete_no_show";
}) {
  const { pending } = useFormStatus();
  const complete = transition !== "start";
  const Icon = transition === "start" ? Video : transition === "complete_no_show" ? UserRoundX : CheckCircle2;

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-xs font-bold disabled:opacity-60",
        complete
          ? "border border-danger/30 bg-white text-danger"
          : "bg-primary text-white"
      )}
    >
      <Icon aria-hidden="true" className="size-4" strokeWidth={2.1} />
      {pending
        ? "กำลังบันทึก"
        : transition === "complete_no_show"
          ? "ยืนยันไม่มาตามนัด"
          : complete
            ? "ยืนยันจบการปรึกษา"
            : "เริ่มการปรึกษา"}
    </button>
  );
}
