"use client";

import Link from "next/link";
import { CalendarPlus, CreditCard, X } from "lucide-react";
import { AdminManualAppointmentIntakeForm } from "@/features/admin/AdminManualAppointmentIntakeForm";
import type { AdminAppointmentCalendarSlot, AdminManualAppointmentPatient } from "@/features/admin/schedules/types";

export function AdminCalendarSlotDrawer({ dateValue, patients, slot, onClose }: { dateValue: string; patients: AdminManualAppointmentPatient[]; slot: AdminAppointmentCalendarSlot; onClose: () => void }) {
  const workingHoursHref = { pathname: "/admin/schedules", query: { date: dateValue, doctor: slot.doctorId }, hash: "date-schedule-form" };
  const canCreateManual = slot.status === "available";
  return <div role="dialog" aria-modal="true" aria-label="จัดการช่วงเวลา" className="fixed inset-0 z-50 flex items-end bg-black/35 sm:items-center sm:justify-center"><section className="max-h-[90vh] w-full overflow-y-auto rounded-t-[16px] bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-[16px]"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-text">จัดการช่วง {slot.timeLabel}</p><p className="mt-1 text-xs text-muted">เลือกประเภทการดำเนินการให้ชัดเจน</p></div><button type="button" onClick={onClose} aria-label="ปิด" className="rounded-[8px] p-2 text-muted"><X className="size-5" /></button></div><div className="mt-4 grid gap-3"><Link href={workingHoursHref} className="rounded-[8px] border border-border p-3 text-left"><span className="flex items-center gap-2 text-sm font-bold text-primary"><CalendarPlus className="size-4" />เพิ่มเวลาทำงานแพทย์</span><span className="mt-1 block text-xs leading-5 text-muted">ไปยัง flow เวลาพิเศษ/วันปิดของวันที่เลือก ไม่มีผู้ป่วยหรือการชำระเงิน</span></Link><div className="rounded-[8px] border border-border p-3"><span className="flex items-center gap-2 text-sm font-bold text-primary"><CreditCard className="size-4" />เพิ่มนัดหมาย Manual</span>{canCreateManual ? <AdminManualAppointmentIntakeForm patients={patients} slot={slot} /> : <p className="mt-2 text-xs leading-5 text-muted">{slot.status === "pending_payment" ? "ช่วงเวลานี้ถูกล็อกระหว่างรอชำระเงิน จึงสร้างคำขอใหม่ไม่ได้" : "ช่วงเวลานี้ไม่ว่าง จึงสร้างคำขอใหม่ไม่ได้"}</p>}</div></div></section></div>;
}
