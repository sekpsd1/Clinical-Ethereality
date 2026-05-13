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
  const [rejectState, rejectAction] = useActionState(reviewPaymentAction, initialActionState);
  const [verifyState, verifyAction] = useActionState(reviewPaymentAction, initialActionState);
  const actionState = verifyState.status !== "idle" ? verifyState : rejectState;

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <div className="flex gap-2">
        <form action={rejectAction}>
          <input type="hidden" name="paymentId" value={payment.id} />
          <input type="hidden" name="status" value="rejected" />
          <ActionIconButton
            ariaLabel={`ปฏิเสธสลิป ${payment.orderCode}`}
            className="border border-danger/20 bg-danger/10 text-danger"
            icon="reject"
          />
        </form>
        <form action={verifyAction}>
          <input type="hidden" name="paymentId" value={payment.id} />
          <input type="hidden" name="status" value="verified" />
          <ActionIconButton ariaLabel={`ยืนยันสลิป ${payment.orderCode}`} className="bg-primary text-white" icon="verify" />
        </form>
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
    </div>
  );
}

function ActionIconButton({
  ariaLabel,
  className,
  icon
}: {
  ariaLabel: string;
  className: string;
  icon: "reject" | "verify";
}) {
  const { pending } = useFormStatus();
  const Icon = icon === "verify" ? CheckCircle2 : XCircle;

  return (
    <button
      type="submit"
      className={cn("inline-flex size-9 items-center justify-center rounded-full disabled:opacity-60", className)}
      aria-label={ariaLabel}
      disabled={pending}
    >
      <Icon aria-hidden="true" className="size-4" strokeWidth={2.1} />
    </button>
  );
}
