"use client";

import { useActionState, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { deactivateAllDoctorSchedulesAction, previewDeactivateAllDoctorSchedulesAction, type AdminScheduleActionState } from "@/features/admin/schedules/actions";

const initialState: AdminScheduleActionState = { status: "idle", message: "" };
const confirmationPhrase = "ปิดตารางทดสอบทั้งหมด";

export function AdminDeactivateAllDoctorSchedules({ doctorCount }: { doctorCount: number }) {
  const [confirmation, setConfirmation] = useState("");
  const [state, action, isPending] = useActionState(deactivateAllDoctorSchedulesAction, initialState);
  const [previewState, previewAction, isPreviewPending] = useActionState(previewDeactivateAllDoctorSchedulesAction, initialState);
  const isConfirmed = confirmation === confirmationPhrase;

  if (doctorCount === 0) return null;

  return (
    <section className="rounded-[8px] border border-danger/30 bg-danger/5 p-4 shadow-payment-card">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-danger/10 text-danger"><AlertTriangle aria-hidden="true" className="size-5" /></span>
        <div>
          <h2 className="font-headline text-lg font-bold text-text">ปิดตารางแพทย์ทดสอบทั้งหมด</h2>
          <p className="mt-1 text-xs leading-5 text-muted">ปิดเฉพาะเวลาประจำและเวลาพิเศษตั้งแต่วันนี้ของแพทย์ที่พร้อมรับนัด {doctorCount} คน โดยไม่ลบนัดหมาย การชำระเงิน บัญชีแพทย์ หรือประวัติ audit</p>
        </div>
      </div>
      <form action={previewAction} className="mt-4"><button type="submit" disabled={isPreviewPending} className="inline-flex min-h-10 items-center justify-center rounded-[8px] border border-danger/40 px-4 text-sm font-bold text-danger disabled:opacity-50">{isPreviewPending ? "กำลังตรวจสอบ..." : "ตรวจสอบก่อนปิดตาราง"}</button></form>
      {previewState.status !== "idle" ? <p className={`mt-3 rounded-[8px] px-3 py-2 text-xs font-semibold ${previewState.status === "success" ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>{previewState.message}</p> : null}
      <form action={action} className="mt-4">
        <label className="block text-xs font-bold text-text">พิมพ์ “{confirmationPhrase}” เพื่อยืนยัน
          <input aria-label="ยืนยันการปิดตารางแพทย์ทดสอบทั้งหมด" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text" />
        </label>
        <input type="hidden" name="confirmation" value={confirmation} />
        <p className="mt-2 text-[11px] leading-5 text-muted">ระบบจะหยุดทันทีหากพบนัดหมายที่ยังไม่สิ้นสุด รายการชำระเงินค่าปรึกษาที่ยังค้าง หรือช่วงเวลาที่ถูกล็อกอยู่</p>
        {state.status !== "idle" ? <p className={`mt-3 rounded-[8px] px-3 py-2 text-xs font-semibold ${state.status === "success" ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>{state.message}</p> : null}
        <button type="submit" disabled={!isConfirmed || isPending} className="mt-4 inline-flex min-h-10 items-center justify-center rounded-[8px] bg-danger px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{isPending ? "กำลังตรวจสอบ..." : "ปิดตารางทั้งหมด"}</button>
      </form>
    </section>
  );
}
