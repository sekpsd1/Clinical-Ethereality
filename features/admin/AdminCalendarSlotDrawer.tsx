"use client";

import { CalendarPlus, CreditCard, X } from "lucide-react";
import { AdminDateScheduleEditor } from "@/features/admin/AdminDateScheduleEditor";
import { AdminManualAppointmentIntakeForm } from "@/features/admin/AdminManualAppointmentIntakeForm";
import type { AdminAppointmentCalendarSlot, AdminDoctorAvailabilityDateOverride, AdminDoctorOption, AdminManualAppointmentPatient } from "@/features/admin/schedules/types";

export function AdminCalendarSlotDrawer({ dateValue, patients, slot, doctors, overrides, onClose }: { dateValue: string; patients: AdminManualAppointmentPatient[]; slot: AdminAppointmentCalendarSlot; doctors: AdminDoctorOption[]; overrides: AdminDoctorAvailabilityDateOverride[]; onClose: () => void }) {
  const canCreateManual = slot.status === "available";
  const manualExplanation = slot.status === "pending_payment" ? "ช่วงเวลานี้ถูกล็อกระหว่างรอชำระเงิน จึงสร้างคำขอใหม่ไม่ได้" : slot.status === "closed" ? "วันนี้ยังไม่มีช่วงเวลารับนัด จึงไม่สามารถสร้างคำขอ Manual ได้" : "ช่วงเวลานี้ไม่ว่าง จึงสร้างคำขอใหม่ไม่ได้";
  const selectedDoctor = doctors.filter((doctor) => doctor.id === slot.doctorId);

  return <div role="dialog" aria-modal="true" aria-label="จัดการช่วงเวลา" className="fixed inset-0 z-50 flex items-end bg-black/35 sm:items-center sm:justify-center"><section className="max-h-[90vh] w-full overflow-y-auto rounded-t-[16px] bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-[16px]"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-text">จัดการช่วง {slot.timeLabel}</p><p className="mt-1 text-xs text-muted">จัดการเวลาทำงานหรือนำส่งคำขอนัดหมายในหน้าต่างเดียวกัน</p></div><button type="button" onClick={onClose} aria-label="ปิด" className="rounded-[8px] p-2 text-muted"><X className="size-5" /></button></div><div className="mt-4 grid gap-3"><div className="rounded-[8px] border border-border p-3"><span className="flex items-center gap-2 text-sm font-bold text-primary"><CalendarPlus className="size-4" />เพิ่มเวลาทำงานแพทย์</span><p className="mt-1 text-xs leading-5 text-muted">เพิ่มเวลาพิเศษหรือปิดรับนัดของแพทย์ที่เลือก โดยใช้การป้องกันฝั่งเซิร์ฟเวอร์เดิม</p><div className="mt-3"><AdminDateScheduleEditor doctors={selectedDoctor} overrides={overrides} selectedDate={dateValue} selectedDoctorId={slot.doctorId} /></div></div><div className="rounded-[8px] border border-border p-3"><span className="flex items-center gap-2 text-sm font-bold text-primary"><CreditCard className="size-4" />เพิ่มนัดหมาย Manual</span>{canCreateManual ? <AdminManualAppointmentIntakeForm patients={patients} slot={slot} /> : <p className="mt-2 rounded-[8px] bg-surface px-3 py-2 text-xs leading-5 text-muted">{manualExplanation}</p>}</div></div></section></div>;
}
