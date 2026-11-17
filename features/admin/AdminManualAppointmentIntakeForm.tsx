"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { createManualAppointmentPaymentIntakeAction, type AdminPaymentActionState } from "@/features/admin/payments/actions";
import { AdminThaiDateTimeField } from "@/features/admin/payments/AdminThaiDateTimeField";
import type { AdminAppointmentCalendarSlot, AdminManualAppointmentPatient } from "@/features/admin/schedules/types";

import { searchManualAppointmentPatients } from "@/features/admin/schedules/manual-patient-search";

const initialState: AdminPaymentActionState = { status: "idle", message: "" };

export function AdminManualAppointmentIntakeForm({ slot }: { slot: AdminAppointmentCalendarSlot }) {
  const [state, action, isPending] = useActionState(createManualAppointmentPaymentIntakeAction, initialState);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminManualAppointmentPatient | null>(null);
  const [response, setSearch] = useState<{ query: string; patients: AdminManualAppointmentPatient[]; hasMore: boolean; failed?: boolean } | null>(null);

  const search = response?.query === query.trim() ? response : null;

  useEffect(() => {
    const name = query.trim();
    if (selected || name.length < 2 || name.length > 191) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void searchManualAppointmentPatients(name).then(
        result => { if (active) setSearch({ ...result, query: name }); },
        () => { if (active) setSearch({ patients: [], hasMore: false, failed: true, query: name }); }
      );
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, selected]);

  return <form action={action}
    onSubmit={event => { if (!selected) event.preventDefault(); }} encType="multipart/form-data" className="mt-4 space-y-3 border-t border-border pt-4">
    <input type="hidden" name="doctorId" value={slot.doctorId} /><input type="hidden" name="availabilityId" value={slot.availabilityId} /><input type="hidden" name="scheduledAt" value={slot.scheduledAtIso} />
    <p className="text-xs leading-5 text-muted">ขั้นตอนนี้สร้างคำขอและล็อกเวลาไว้ชั่วคราวเพื่อส่งเข้าคิวตรวจเท่านั้น ยังไม่ยืนยันนัดหมายหรือการชำระเงิน</p>
    <div className="space-y-2">
      <label className="block text-xs font-bold text-text">
        ผู้ป่วยที่ยืนยันแล้ว
        <input
          type="search"
          maxLength={191}
          value={selected?.name ?? query}
          placeholder="พิมพ์ชื่อผู้ป่วยอย่างน้อย 2 ตัวอักษร"
          disabled={isPending}
          readOnly={Boolean(selected)}
          onChange={event => {
            setQuery(event.target.value);
            setSearch(null);
          }}
          onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) event.preventDefault(); }}
          className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm"
        />
      </label>
      <input type="hidden" name="patientId" value={selected?.id ?? ""} />
      {selected ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="break-all text-muted">รหัสผู้ป่วย {selected.id}</span>
          <button type="button" disabled={isPending} className="font-bold text-primary underline" onClick={() => {
            setSelected(null);
            setQuery("");
            setSearch(null);
          }}>ล้างผู้ป่วยที่เลือก</button>
        </div>
      ) : null}
      {!selected && query.trim().length >= 2 ? (
        <div>
          <p role="status" className="text-xs text-muted">
            {!search ? "กำลังค้นหา..." : search.failed ? "ค้นหาไม่สำเร็จ กรุณาแก้ไขคำค้นแล้วลองอีกครั้ง"
              : search.patients.length === 0 ? "ไม่พบผู้ป่วยที่ยืนยันแล้ว"
                : search.hasMore ? "แสดง 20 รายการแรก กรุณาพิมพ์ชื่อเพิ่มเพื่อให้ผลตรงขึ้น"
                  : "ตรวจชื่อและรหัสก่อนเลือกผู้ป่วย"}
          </p>
          {search?.patients.length ? (
            <ul className="mt-2 max-h-48 overflow-y-auto rounded-[8px] border border-border">
              {search.patients.map(patient => (
                <li key={patient.id} className="border-b border-border last:border-0">
                  <button type="button" disabled={isPending} onClick={() => setSelected(patient)} className="w-full px-3 py-2 text-left hover:bg-primary/5 focus-visible:bg-primary/5">
                    <span className="block text-sm font-bold text-text">{patient.name}</span>
                    <span className="block break-all text-xs text-muted">รหัสผู้ป่วย {patient.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
    <label className="block text-xs font-bold text-text">หลักฐานการโอน<input required type="file" name="evidence" accept="image/jpeg,image/png,image/webp" disabled={isPending} className="mt-1 block w-full text-xs text-muted" /></label>
    <AdminThaiDateTimeField label="วันเวลาโอน" name="transferredAt" disabled={isPending} />
    <label className="block text-xs font-bold text-text">เหตุผลที่รับคำขอตรวจ<select required name="reasonCode" defaultValue="provider_unavailable" disabled={isPending} className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm"><option value="provider_unavailable">ผู้ให้บริการไม่พร้อมใช้งาน</option><option value="provider_timeout">ผู้ให้บริการหมดเวลา</option><option value="provider_result_ambiguous">ผลจากผู้ให้บริการไม่ชัดเจน</option></select></label>
    <label className="flex items-start gap-2 text-xs font-semibold leading-5 text-muted"><input required type="checkbox" name="confirmedManualIntake" value="true" disabled={isPending} className="mt-0.5 size-4 accent-primary" />ยืนยันว่าได้รับหลักฐานการโอนเพื่อส่งเข้าคิวตรวจ ไม่ใช่การยืนยันชำระเงิน</label>
    <AdminManualAppointmentFeedback state={state} />
    <button type="submit" disabled={isPending || !selected} className="min-h-10 w-full rounded-full bg-primary-gradient px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{isPending ? "กำลังส่งคำขอ..." : "ส่งคำขอนัด Manual เข้าคิวตรวจ"}</button>
  </form>;
}

export function AdminManualAppointmentFeedback({ state }: { state: AdminPaymentActionState }) {
  if (state.status === "idle") return null;

  return <div className="space-y-3">
    <p role="status" className={state.status === "success" ? "text-xs font-semibold text-success" : "text-xs font-semibold text-danger"}>{state.message}</p>
    {state.status === "success" ? <Link href="/admin/payments" className="flex min-h-10 w-full items-center justify-center rounded-full border border-primary/20 bg-primary/5 px-4 text-center text-sm font-bold text-primary">ไปตรวจและยืนยันในหน้าชำระเงิน</Link> : null}
  </div>;
}
