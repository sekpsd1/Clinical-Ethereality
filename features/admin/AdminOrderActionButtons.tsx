"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, PackageCheck, Truck } from "lucide-react";
import { updateOrderFulfillmentAction } from "@/features/admin/orders/actions";
import { cn } from "@/lib/design-system/variants";
import type { AdminOrderActionState } from "@/features/admin/orders/actions";
import type { AdminOrderQueueItem } from "@/features/admin/orders/types";

type AdminOrderActionButtonsProps = {
  order: Pick<AdminOrderQueueItem, "id" | "orderCode" | "status">;
};

const initialActionState: AdminOrderActionState = {
  status: "idle",
  message: ""
};

export function AdminOrderActionButtons({ order }: AdminOrderActionButtonsProps) {
  const [prepareState, prepareAction] = useActionState(updateOrderFulfillmentAction, initialActionState);
  const [shipState, shipAction] = useActionState(updateOrderFulfillmentAction, initialActionState);
  const [deliverState, deliverAction] = useActionState(updateOrderFulfillmentAction, initialActionState);
  const actionState = deliverState.status !== "idle" ? deliverState : shipState.status !== "idle" ? shipState : prepareState;

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <div className="flex gap-2">
        {order.status === "paid" ? (
          <OrderActionForm
            action={prepareAction}
            actionName="mark_preparing"
            ariaLabel={`เริ่มจัดเตรียม ${order.orderCode}`}
            className="bg-primary text-white"
            icon="prepare"
          />
        ) : null}
        {order.status === "preparing" ? (
          <OrderActionForm
            action={shipAction}
            actionName="mark_shipped"
            ariaLabel={`จัดส่ง ${order.orderCode}`}
            className="bg-primary text-white"
            icon="ship"
          />
        ) : null}
        {order.status === "shipped" ? (
          <OrderActionForm
            action={deliverAction}
            actionName="mark_delivered"
            ariaLabel={`ยืนยันส่งถึงแล้ว ${order.orderCode}`}
            className="bg-success text-white"
            icon="deliver"
          />
        ) : null}
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

  function OrderActionForm({
    action,
    actionName,
    ariaLabel,
    className,
    icon
  }: {
    action: (payload: FormData) => void;
    actionName: "mark_preparing" | "mark_shipped" | "mark_delivered";
    ariaLabel: string;
    className: string;
    icon: "prepare" | "ship" | "deliver";
  }) {
    return (
      <form action={action}>
        <input type="hidden" name="orderId" value={order.id} />
        <input type="hidden" name="action" value={actionName} />
        <ActionIconButton ariaLabel={ariaLabel} className={className} icon={icon} />
      </form>
    );
  }
}

function ActionIconButton({
  ariaLabel,
  className,
  icon
}: {
  ariaLabel: string;
  className: string;
  icon: "prepare" | "ship" | "deliver";
}) {
  const { pending } = useFormStatus();
  const Icon = icon === "prepare" ? PackageCheck : icon === "ship" ? Truck : CheckCircle2;

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
