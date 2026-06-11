"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, PackageCheck, Truck } from "lucide-react";
import { updatePharmacistOrderAction } from "@/features/pharmacist/orders/actions";
import { cn } from "@/lib/design-system/variants";
import type { PharmacistOrderActionState } from "@/features/pharmacist/orders/actions";
import type { PharmacistOrderQueueItem } from "@/features/pharmacist/orders/types";

type PharmacistOrderActionButtonsProps = {
  order: Pick<PharmacistOrderQueueItem, "id" | "orderCode" | "status">;
};

const initialActionState: PharmacistOrderActionState = {
  status: "idle",
  message: ""
};

export function PharmacistOrderActionButtons({ order }: PharmacistOrderActionButtonsProps) {
  const [prepareState, prepareAction] = useActionState(updatePharmacistOrderAction, initialActionState);
  const [shipState, shipAction] = useActionState(updatePharmacistOrderAction, initialActionState);
  const [deliverState, deliverAction] = useActionState(updatePharmacistOrderAction, initialActionState);
  const actionState = deliverState.status !== "idle" ? deliverState : shipState.status !== "idle" ? shipState : prepareState;

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <div className="flex gap-2">
        {order.status === "paid" ? (
          <OrderActionForm
            action={prepareAction}
            actionName="mark_preparing"
            ariaLabel={`เริ่มจัดเตรียมยา ${order.orderCode}`}
            className="bg-primary text-white"
            icon="prepare"
            title="เริ่มจัดเตรียม"
          />
        ) : null}
        {order.status === "preparing" ? (
          <OrderActionForm
            action={shipAction}
            actionName="mark_shipped"
            ariaLabel={`บันทึกว่าออเดอร์ ${order.orderCode} จัดส่งแล้ว`}
            className="bg-primary text-white"
            icon="ship"
            title="จัดส่งแล้ว"
          />
        ) : null}
        {order.status === "shipped" ? (
          <OrderActionForm
            action={deliverAction}
            actionName="mark_delivered"
            ariaLabel={`บันทึกว่าออเดอร์ ${order.orderCode} ส่งสำเร็จแล้ว`}
            className="bg-success text-white"
            icon="deliver"
            title="ส่งสำเร็จ"
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
    icon,
    title
  }: {
    action: (payload: FormData) => void;
    actionName: "mark_preparing" | "mark_shipped" | "mark_delivered";
    ariaLabel: string;
    className: string;
    icon: "prepare" | "ship" | "deliver";
    title: string;
  }) {
    return (
      <form action={action}>
        <input type="hidden" name="orderId" value={order.id} />
        <input type="hidden" name="action" value={actionName} />
        <ActionIconButton ariaLabel={ariaLabel} className={className} icon={icon} title={title} />
      </form>
    );
  }
}

function ActionIconButton({
  ariaLabel,
  className,
  icon,
  title
}: {
  ariaLabel: string;
  className: string;
  icon: "prepare" | "ship" | "deliver";
  title: string;
}) {
  const { pending } = useFormStatus();
  const Icon = icon === "prepare" ? PackageCheck : icon === "ship" ? Truck : CheckCircle2;

  return (
    <button
      type="submit"
      className={cn("inline-flex size-9 items-center justify-center rounded-full disabled:opacity-60", className)}
      aria-label={ariaLabel}
      disabled={pending}
      title={title}
    >
      <Icon aria-hidden="true" className="size-4" strokeWidth={2.1} />
    </button>
  );
}
