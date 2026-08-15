"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { RotateCcw } from "lucide-react";
import { refundStorePaymentAction, type AdminPaymentActionState } from "@/features/admin/payments/actions";
import { cn } from "@/lib/design-system/variants";
import type { AdminPaymentQueueItem } from "@/features/admin/payments/types";
import type { ManualRefundReadiness } from "@/features/payments/refund-readiness";

const initialActionState: AdminPaymentActionState = {
  status: "idle",
  message: ""
};

export function AdminPaymentRefundForm({
  payment,
  readiness
}: {
  payment: Pick<AdminPaymentQueueItem, "id" | "amount" | "orderCode" | "refundAmountInput">;
  readiness: ManualRefundReadiness;
}) {
  const [state, formAction] = useActionState(refundStorePaymentAction, initialActionState);

  if (readiness.status !== "ready") {
    return (
      <section
        className="mt-3 rounded-[8px] border border-warning/30 bg-warning/5 p-3"
        data-refund-readiness={readiness.status}
        aria-label="สถานะการคืนเงิน"
      >
        <p className="text-xs font-bold text-text">{readiness.message}</p>
        <p className="mt-1 text-[11px] leading-5 text-muted">ห้ามโอนเงินคืนจนกว่าระบบจะแสดงว่าพร้อมบันทึกคืนเงิน</p>
        <button
          type="button"
          disabled
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-[8px] bg-muted px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          ยังไม่เปิดใช้ฟอร์มคืนเงิน
        </button>
      </section>
    );
  }

  return (
    <form action={formAction} className="mt-3 rounded-[8px] border border-danger/20 bg-danger/5 p-3">
      <input type="hidden" name="paymentId" value={payment.id} />
      <p className="text-xs font-bold text-danger">คืนเงินเต็มจำนวนหลังโอนผ่านธนาคารภายนอกแล้วเท่านั้น</p>
      <div className="mt-2 grid gap-2 text-xs">
        <label className="font-semibold text-muted" htmlFor={`refund-reference-${payment.id}`}>
          เลขอ้างอิงการโอนคืน
        </label>
        <input
          id={`refund-reference-${payment.id}`}
          name="refundTransactionReference"
          type="text"
          autoComplete="off"
          maxLength={255}
          className="rounded-[8px] border border-border bg-white px-3 py-2 font-semibold text-text outline-none focus:border-primary"
        />
        <label className="font-semibold text-muted" htmlFor={`refund-amount-${payment.id}`}>
          จำนวนคืน (ต้องเท่ากับ {payment.amount})
        </label>
        <input
          id={`refund-amount-${payment.id}`}
          name="refundAmount"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          defaultValue={payment.refundAmountInput}
          required
          className="rounded-[8px] border border-border bg-white px-3 py-2 font-semibold text-text outline-none focus:border-primary"
        />
        <label className="font-semibold text-muted" htmlFor={`refund-reason-${payment.id}`}>
          เหตุผลการคืนเงิน
        </label>
        <textarea
          id={`refund-reason-${payment.id}`}
          name="refundReason"
          rows={2}
          maxLength={1000}
          required
          className="rounded-[8px] border border-border bg-white px-3 py-2 font-semibold text-text outline-none focus:border-primary"
        />
        <label className="flex items-start gap-2 text-xs font-semibold text-text">
          <input name="confirmedExternalTransfer" type="checkbox" value="true" className="mt-0.5 size-4 accent-primary" />
          ฉันยืนยันว่าโอนเงินคืนผ่านธนาคารภายนอกสำเร็จแล้ว
        </label>
      </div>
      <RefundSubmitButton orderCode={payment.orderCode} />
      {state.status !== "idle" ? (
        <p className={cn("mt-2 text-[11px] font-semibold", state.status === "success" ? "text-success" : "text-danger")} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function RefundSubmitButton({ orderCode }: { orderCode: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-danger px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
    >
      <RotateCcw aria-hidden="true" className="size-4" />
      บันทึกคืนเงิน {orderCode}
    </button>
  );
}
