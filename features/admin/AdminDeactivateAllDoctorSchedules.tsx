"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { deactivateAllDoctorSchedulesAction, previewDeactivateAllDoctorSchedulesAction, type AdminScheduleActionState } from "@/features/admin/schedules/actions";
import { cancelConsultationForTestResetAction, previewConsultationTestResetAction, type AdminConsultationTestResetActionState } from "@/features/admin/consultation-test-reset/actions";

const initialState: AdminScheduleActionState = { status: "idle", message: "" };
const confirmationPhrase = "ปิดตารางทดสอบทั้งหมด";
const resetConfirmationPhrase = "รีเซ็ตนัดทดสอบ";
const testResetInitialState: AdminConsultationTestResetActionState = { status: "idle", message: "" };

export function AdminDeactivateAllDoctorSchedules({ doctorCount }: { doctorCount: number }) {
  const [confirmation, setConfirmation] = useState("");
  const [state, action, isPending] = useActionState(deactivateAllDoctorSchedulesAction, initialState);
  const [previewState, previewAction, isPreviewPending] = useActionState(previewDeactivateAllDoctorSchedulesAction, initialState);
  const [resetId, setResetId] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [testPreview, testPreviewAction, isTestPreviewPending] = useActionState(previewConsultationTestResetAction, testResetInitialState);
  const [resetState, resetAction, isResetPending] = useActionState(cancelConsultationForTestResetAction, testResetInitialState);
  const isConfirmed = confirmation === confirmationPhrase;
  const canReset = testPreview.preview?.eligible === true && testPreview.preview.target?.consultationId === resetId && resetConfirmation === resetConfirmationPhrase;
  const scheduleClear = previewState.status === "success";

  useEffect(() => {
    if (resetState.status === "success") previewAction();
  }, [previewAction, resetState.status]);

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
      <section className="mt-4 rounded-[8px] border border-warning/30 bg-warning/5 p-3">
        <h3 className="text-sm font-bold text-text">รีเซ็ตนัดทดสอบเฉพาะรายการ</h3>
        <p className="mt-1 text-xs leading-5 text-muted">ใช้ได้เฉพาะ UAT fixture ที่ระบบตรวจสอบแล้วเท่านั้น การรีเซ็ตจะยกเลิกนัด แต่เก็บ Payment หลักฐาน และ audit ไว้ทั้งหมด</p>
        <form action={testPreviewAction} className="mt-3 flex flex-col gap-2 sm:flex-row"><input name="consultationId" aria-label="รหัสนัดทดสอบ" value={resetId} onChange={(event) => setResetId(event.target.value)} placeholder="รหัสนัดทดสอบ" required className="h-10 flex-1 rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text" /><button type="submit" disabled={isTestPreviewPending} className="min-h-10 rounded-[8px] border border-warning/40 px-4 text-sm font-bold text-warning disabled:opacity-50">{isTestPreviewPending ? "กำลังตรวจ..." : "Preview นัดทดสอบ"}</button></form>
        {testPreview.preview?.target ? <div className="mt-3 rounded-[8px] bg-white/70 p-3 text-xs text-text"><p>รหัส: {testPreview.preview.target.consultationId}</p><p>แพทย์: {testPreview.preview.target.doctorId}</p><p>สถานะ: {testPreview.preview.target.status}</p><p>เวลานัด: {testPreview.preview.target.scheduledAt ?? "ไม่กำหนด"}</p><p>Payment: {testPreview.preview.target.payment?.status ?? "ไม่มี"} • Slot lock: {testPreview.preview.target.slotLock?.status ?? "ไม่มี"}</p></div> : null}
        {testPreview.status !== "idle" ? <p className={`mt-3 text-xs font-semibold ${testPreview.status === "success" ? "text-primary" : "text-danger"}`}>{testPreview.message}</p> : null}
        <form action={resetAction} className="mt-3"><input type="hidden" name="consultationId" value={resetId} /><input type="hidden" name="confirmedConsultationId" value={resetId} /><input type="hidden" name="expectedStatus" value={testPreview.preview?.target?.status ?? ""} /><input type="hidden" name="expectedUpdatedAt" value={testPreview.preview?.target?.expectedUpdatedAt ?? ""} /><input type="hidden" name="reason" value="test_data_reset" /><label className="block text-xs font-bold text-text">พิมพ์ “{resetConfirmationPhrase}” เพื่อยืนยัน<input aria-label="ยืนยันการรีเซ็ตนัดทดสอบ" value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text" /></label><button type="submit" disabled={!canReset || isResetPending} className="mt-3 min-h-10 rounded-[8px] bg-warning px-4 text-sm font-bold text-white disabled:opacity-50">{isResetPending ? "กำลังรีเซ็ต..." : "ยกเลิกนัดทดสอบ"}</button></form>
        {resetState.status !== "idle" ? <p className={`mt-3 text-xs font-semibold ${resetState.status === "success" ? "text-primary" : "text-danger"}`}>{resetState.message}</p> : null}
      </section>
      <form action={previewAction} className="mt-4"><button type="submit" disabled={isPreviewPending} className="inline-flex min-h-10 items-center justify-center rounded-[8px] border border-danger/40 px-4 text-sm font-bold text-danger disabled:opacity-50">{isPreviewPending ? "กำลังตรวจสอบ..." : "ตรวจสอบก่อนปิดตาราง"}</button></form>
      {previewState.status !== "idle" ? <p className={`mt-3 rounded-[8px] px-3 py-2 text-xs font-semibold ${previewState.status === "success" ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>{previewState.message}</p> : null}
      <form action={action} className="mt-4">
        <label className="block text-xs font-bold text-text">พิมพ์ “{confirmationPhrase}” เพื่อยืนยัน
          <input aria-label="ยืนยันการปิดตารางแพทย์ทดสอบทั้งหมด" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text" />
        </label>
        <input type="hidden" name="confirmation" value={confirmation} />
        <p className="mt-2 text-[11px] leading-5 text-muted">ระบบจะหยุดทันทีหากพบนัดหมายที่ยังไม่สิ้นสุด รายการชำระเงินค่าปรึกษาที่ยังค้าง หรือช่วงเวลาที่ถูกล็อกอยู่</p>
        {state.status !== "idle" ? <p className={`mt-3 rounded-[8px] px-3 py-2 text-xs font-semibold ${state.status === "success" ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>{state.message}</p> : null}
        <button type="submit" disabled={!isConfirmed || !scheduleClear || isPending} className="mt-4 inline-flex min-h-10 items-center justify-center rounded-[8px] bg-danger px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{isPending ? "กำลังตรวจสอบ..." : "ปิดตารางทั้งหมด"}</button>
      </form>
    </section>
  );
}
