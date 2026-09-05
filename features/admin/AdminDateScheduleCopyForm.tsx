"use client";

import { useActionState, useMemo, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { copyDoctorAvailabilityDateOverridesAction, type AdminScheduleActionState } from "@/features/admin/schedules/actions";
import type { AdminDoctorAvailabilityDateOverride } from "@/features/admin/schedules/types";

const initialState: AdminScheduleActionState = { status: "idle", message: "" };

export function AdminDateScheduleCopyForm({ doctorId, sourceDate, sourceOverrides }: { doctorId: string; sourceDate: string; sourceOverrides: AdminDoctorAvailabilityDateOverride[] }) {
  const [state, action, isPending] = useActionState(copyDoctorAvailabilityDateOverridesAction, initialState);
  const [targetDates, setTargetDates] = useState([""]);
  const [confirmed, setConfirmed] = useState(false);
  const sourceSummary = useMemo(() => sourceOverrides.map((item) => item.type === "closed" ? "วันหยุด (ปิดทั้งวัน)" : `${item.timeRange} • รอบละ ${item.slotMinutes} นาที`), [sourceOverrides]);
  const filledTargets = targetDates.filter(Boolean);

  if (sourceOverrides.length === 0) {
    return <p className="mt-4 rounded-[8px] border border-dashed border-border p-3 text-xs leading-5 text-muted">การคัดลอกใช้กับ “ตารางพิเศษตามวันที่” ที่บันทึกไว้แล้วเท่านั้น ตารางประจำจะมีผลตามวันในสัปดาห์โดยอัตโนมัติ</p>;
  }

  return (
    <form action={action} className="mt-4 border-t border-border pt-4">
      <input type="hidden" name="doctorId" value={doctorId} />
      <input type="hidden" name="sourceDate" value={sourceDate} />
      <div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary"><Copy aria-hidden="true" className="size-4" /></span><div><p className="text-sm font-bold text-text">คัดลอกไปวันที่อื่น</p><p className="mt-1 text-xs leading-5 text-muted">เลือกหนึ่งวันหรือหลายวันปลายทาง ระบบจะแสดงรายการที่จะคัดลอกก่อนยืนยัน</p></div></div>
      <div className="mt-3 rounded-[8px] bg-primary/5 p-3 text-xs"><p className="font-bold text-text">จากวันที่ {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${sourceDate}T00:00:00.000Z`))}</p><p className="mt-1 text-muted">{sourceSummary.join(" / ")}</p></div>
      <div className="mt-3 space-y-2">{targetDates.map((targetDate, index) => <div key={index} className="flex items-end gap-2"><label className="min-w-0 flex-1"><span className="text-[11px] font-bold text-muted">วันปลายทาง {index + 1}</span><input type="date" name="targetDates" value={targetDate} min={sourceDate} onChange={(event) => setTargetDates((current) => current.map((value, valueIndex) => valueIndex === index ? event.target.value : value))} disabled={isPending} className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-semibold text-text" /></label>{targetDates.length > 1 ? <button type="button" aria-label="ลบวันปลายทาง" onClick={() => setTargetDates((current) => current.filter((_, valueIndex) => valueIndex !== index))} disabled={isPending} className="h-11 rounded-[8px] border border-[#ba1a1a]/30 px-3 text-[#93000a]"><Trash2 aria-hidden="true" className="size-4" /></button> : null}</div>)}</div>
      <button type="button" onClick={() => setTargetDates((current) => [...current, ""])} disabled={isPending || targetDates.length >= 31} className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-[8px] border border-border px-3 text-xs font-bold text-primary"><Plus aria-hidden="true" className="size-3.5" />เพิ่มวันปลายทาง</button>
      {filledTargets.length > 0 ? <div className="mt-3 rounded-[8px] border border-border bg-white p-3 text-xs"><p className="font-bold text-text">สรุปก่อนยืนยัน</p><p className="mt-1 leading-5 text-muted">คัดลอก {sourceSummary.join(" / ")} ไปยัง {filledTargets.length} วัน: {filledTargets.join(", ")}</p><label className="mt-3 flex items-start gap-2 font-semibold text-text"><input name="confirm" type="checkbox" value="copy" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={isPending} className="mt-0.5 size-4 accent-primary" />ฉันตรวจสอบวันปลายทางแล้ว และยืนยันคัดลอกตาราง</label></div> : null}
      {state.status !== "idle" ? <p className={`mt-3 rounded-[8px] px-3 py-2 text-xs font-semibold ${state.status === "success" ? "bg-primary/10 text-primary" : "bg-[#ba1a1a]/10 text-[#93000a]"}`}>{state.message}</p> : null}
      <button type="submit" disabled={isPending || filledTargets.length === 0 || !confirmed} className="mt-3 h-11 w-full rounded-full border border-primary bg-white text-sm font-bold text-primary disabled:opacity-50">{isPending ? "กำลังคัดลอก..." : `ยืนยันคัดลอกไป ${filledTargets.length} วัน`}</button>
    </form>
  );
}
