"use client";

import { useActionState } from "react";
import { RotateCcw } from "lucide-react";
import {
  resetCustomerAssessmentsAction,
  type AdminCustomerAssessmentActionState
} from "@/features/admin/customers/actions";
import { cn } from "@/lib/design-system/variants";

const initialState: AdminCustomerAssessmentActionState = {
  status: "idle",
  message: ""
};

export function AdminCustomerAssessmentResetButton({
  customerId,
  customerName
}: {
  customerId: string;
  customerName: string;
}) {
  const [state, action, isPending] = useActionState(resetCustomerAssessmentsAction, initialState);

  return (
    <form
      action={action}
      className="mt-4 border-t border-border/70 pt-4"
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `ต้องการให้ ${customerName} ทำแบบประเมินใหม่ใช่ไหม? ประวัติเดิมจะไม่ถูกลบและนัดหมายเดิมจะไม่เปลี่ยนแปลง`
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="customerId" value={customerId} />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-warning/30 bg-warning/10 px-4 text-sm font-bold text-warning disabled:opacity-60 sm:w-auto"
      >
        <RotateCcw aria-hidden="true" className="size-4" strokeWidth={2.1} />
        {isPending ? "กำลังปรับสถานะ..." : "ให้ลูกค้าทำแบบประเมินใหม่"}
      </button>
      <p
        className={cn(
          "mt-2 text-xs font-semibold leading-5",
          state.status === "success" ? "text-success" : state.status === "error" ? "text-danger" : "text-muted"
        )}
        role="status"
      >
        {state.status === "idle"
          ? "ระบบจะทำให้แบบประเมินที่ยังใช้งานอยู่หมดอายุ แต่ไม่ลบประวัติและไม่ยกเลิกนัดหมาย"
          : state.message}
      </p>
    </form>
  );
}
