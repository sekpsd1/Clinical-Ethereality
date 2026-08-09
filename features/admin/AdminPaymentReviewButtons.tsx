"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { reviewPaymentAction } from "@/features/admin/payments/actions";
import { cn } from "@/lib/design-system/variants";
import type { AdminPaymentActionState } from "@/features/admin/payments/actions";
import type { AdminPaymentQueueItem } from "@/features/admin/payments/types";

type AdminPaymentReviewButtonsProps = {
  payment: Pick<AdminPaymentQueueItem, "id" | "orderCode">;
};

const initialActionState: AdminPaymentActionState = {
  status: "idle",
  message: ""
};

export function AdminPaymentReviewButtons({ payment }: AdminPaymentReviewButtonsProps) {
  const [actionState, formAction] = useActionState(reviewPaymentAction, initialActionState);

  return (
    <form action={formAction} className="flex shrink-0 flex-col items-end gap-2">
      <input type="hidden" name="paymentId" value={payment.id} />
      <label className="w-full text-[10px] font-bold text-muted" htmlFor={`transaction-reference-${payment.id}`}>
        เลขอ้างอิงธนาคาร (ต้องระบุเมื่อยืนยัน)
      </label>
      <input
        id={`transaction-reference-${payment.id}`}
        name="transactionReference"
        type="text"
        inputMode="text"
        autoComplete="off"
        maxLength={255}
        className="w-full rounded-[8px] border border-border bg-white px-3 py-2 text-xs font-semibold text-text outline-none focus:border-primary"
      />
      <div className="flex gap-2">
        <ActionIconButton
          ariaLabel={`ปฏิเสธสลิป ${payment.orderCode}`}
          className="border border-danger/20 bg-danger/10 text-danger"
          icon="reject"
          status="rejected"
        />
        <ActionIconButton
          ariaLabel={`ยืนยันสลิป ${payment.orderCode}`}
          className="bg-primary text-white"
          icon="verify"
          status="verified"
        />
      </div>
      {actionState.status !== "idle" ? (
        <p
          className={cn(
            "max-w-[180px] text-right text-[11px] font-semibold leading-4",
            actionState.status === "success" ? "text-success" : "text-danger"
          )}
          role="status"
        >
          {actionState.message}
        </p>
      ) : null}
    </form>
  );
}

function ActionIconButton({
  ariaLabel,
  className,
  icon,
  status
}: {
  ariaLabel: string;
  className: string;
  icon: "reject" | "verify";
  status: "rejected" | "verified";
}) {
  const { pending } = useFormStatus();
  const Icon = icon === "verify" ? CheckCircle2 : XCircle;

  return (
    <button
      type="submit"
      name="status"
      value={status}
      className={cn("inline-flex size-9 items-center justify-center rounded-full disabled:opacity-60", className)}
      aria-label={ariaLabel}
      disabled={pending}
    >
      <Icon aria-hidden="true" className="size-4" strokeWidth={2.1} />
    </button>
  );
}
