"use client";

import { useActionState } from "react";
import { toggleDoctorAvailabilityAction, type AdminScheduleActionState } from "@/features/admin/schedules/actions";

const initialState: AdminScheduleActionState = {
  status: "idle",
  message: ""
};

export function AdminScheduleToggleButton({ availabilityId, isActive }: { availabilityId: string; isActive: boolean }) {
  const [state, action, isPending] = useActionState(toggleDoctorAvailabilityAction, initialState);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="availabilityId" value={availabilityId} />
      <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />
      <button
        type="submit"
        disabled={isPending}
        aria-label={isActive ? "ปิดเวลาว่างนี้" : "เปิดเวลาว่างนี้"}
        className="inline-flex min-h-9 items-center justify-center rounded-[8px] bg-primary/10 px-3 text-xs font-bold text-primary disabled:opacity-50"
      >
        {isPending ? "กำลังบันทึก" : isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
      </button>
      {state.status === "error" ? <span className="text-[11px] font-semibold text-[#93000a]">{state.message}</span> : null}
    </form>
  );
}
