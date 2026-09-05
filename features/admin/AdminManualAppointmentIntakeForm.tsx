"use client";

import { useActionState } from "react";
import { createManualAppointmentPaymentIntakeAction, type AdminPaymentActionState } from "@/features/admin/payments/actions";
import type { AdminAppointmentCalendarSlot, AdminManualAppointmentPatient } from "@/features/admin/schedules/types";

const initialState: AdminPaymentActionState = { status: "idle", message: "" };

export function AdminManualAppointmentIntakeForm({ patients, slot }: { patients: AdminManualAppointmentPatient[]; slot: AdminAppointmentCalendarSlot }) {
  const [state, action, isPending] = useActionState(createManualAppointmentPaymentIntakeAction, initialState);
  return <form action={action} encType="multipart/form-data" className="mt-4 space-y-3 border-t border-border pt-4">
    <input type="hidden" name="doctorId" value={slot.doctorId} /><input type="hidden" name="availabilityId" value={slot.availabilityId} /><input type="hidden" name="scheduledAt" value={slot.scheduledAtIso} />
    <p className="text-xs leading-5 text-muted">คำขอนี้จะสร้างรายการรอตรวจเท่านั้น ยังไม่ยืนยันนัดหมายจนกว่า Admin จะตรวจหลักฐานในคิวชำระเงิน</p>
    <label className="block text-xs font-bold text-text">ผู้ป่วยที่ยืนยันแล้ว<select required name="patientId" defaultValue="" disabled={isPending || patients.length === 0} className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm"><option value="">เลือกผู้ป่วย</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}</select></label>
    <label className="block text-xs font-bold text-text">หลักฐานการโอน<input required type="file" name="evidence" accept="image/jpeg,image/png,image/webp" disabled={isPending} className="mt-1 block w-full text-xs text-muted" /></label>
    <label className="block text-xs font-bold text-text">วันเวลาโอน (ประเทศไทย)<input required type="datetime-local" name="transferredAt" disabled={isPending} className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm" /></label>
    <label className="block text-xs font-bold text-text">เหตุผลที่รับคำขอตรวจ<select required name="reasonCode" defaultValue="provider_unavailable" disabled={isPending} className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm"><option value="provider_unavailable">ผู้ให้บริการไม่พร้อมใช้งาน</option><option value="provider_timeout">ผู้ให้บริการหมดเวลา</option><option value="provider_result_ambiguous">ผลจากผู้ให้บริการไม่ชัดเจน</option></select></label>
    <label className="flex items-start gap-2 text-xs font-semibold leading-5 text-muted"><input required type="checkbox" name="confirmedManualIntake" value="true" disabled={isPending} className="mt-0.5 size-4 accent-primary" />ยืนยันว่าได้รับหลักฐานการโอนเพื่อส่งเข้าคิวตรวจ ไม่ใช่การยืนยันชำระเงิน</label>
    {state.status !== "idle" ? <p role="status" className={state.status === "success" ? "text-xs font-semibold text-success" : "text-xs font-semibold text-danger"}>{state.message}</p> : null}
    <button type="submit" disabled={isPending || patients.length === 0} className="h-10 w-full rounded-full bg-primary-gradient text-sm font-bold text-white disabled:opacity-50">{isPending ? "กำลังส่งคำขอ..." : "ส่งเข้าคิวตรวจยอด"}</button>
  </form>;
}
