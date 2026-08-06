"use client";

import { useActionState, useState } from "react";
import { deleteDoctorAvailabilityDateOverrideAction, type AdminScheduleActionState } from "@/features/admin/schedules/actions";

const initialState: AdminScheduleActionState = { status: "idle", message: "" };

export function AdminDateScheduleDeleteButton({ overrideId }: { overrideId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, isPending] = useActionState(deleteDoctorAvailabilityDateOverrideAction, initialState);

  if (!confirming) {
    return <button type="button" onClick={() => setConfirming(true)} className="inline-flex min-h-9 items-center justify-center rounded-[8px] border border-[#ba1a1a]/30 px-3 text-xs font-bold text-[#93000a]">ลบ</button>;
  }

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="overrideId" value={overrideId} />
      <input type="hidden" name="confirm" value="delete" />
      <button type="submit" disabled={isPending} className="inline-flex min-h-9 items-center justify-center rounded-[8px] bg-[#ba1a1a] px-3 text-xs font-bold text-white disabled:opacity-50">{isPending ? "กำลังลบ..." : "ยืนยันลบ"}</button>
      <button type="button" onClick={() => setConfirming(false)} disabled={isPending} className="text-xs font-bold text-muted">ยกเลิก</button>
      {state.status === "error" ? <p className="text-[10px] font-semibold text-[#93000a]">{state.message}</p> : null}
    </form>
  );
}
