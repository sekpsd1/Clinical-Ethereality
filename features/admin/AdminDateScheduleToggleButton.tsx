"use client";

import { useActionState } from "react";
import { toggleDoctorAvailabilityDateOverrideAction, type AdminScheduleActionState } from "@/features/admin/schedules/actions";

const initialState: AdminScheduleActionState = { status: "idle", message: "" };

export function AdminDateScheduleToggleButton({ overrideId, isActive }: { overrideId: string; isActive: boolean }) {
  const [state, action, isPending] = useActionState(toggleDoctorAvailabilityDateOverrideAction, initialState);

  return (
    <form action={action}>
      <input type="hidden" name="overrideId" value={overrideId} />
      <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />
      <button type="submit" disabled={isPending} className="inline-flex min-h-9 items-center justify-center rounded-[8px] bg-primary/10 px-3 text-xs font-bold text-primary disabled:opacity-50">
        {isPending ? "กำลังบันทึก..." : isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
      </button>
      {state.status === "error" ? <p className="mt-1 text-right text-[10px] font-semibold text-[#93000a]">{state.message}</p> : null}
    </form>
  );
}
