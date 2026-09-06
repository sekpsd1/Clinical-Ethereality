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
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
      <div className="flex gap-2 self-end">
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
          <form action={shipAction} className="w-full space-y-3 rounded-[8px] border border-primary/15 bg-primary/5 p-3 sm:min-w-[280px]">
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="action" value="mark_shipped" />
            <label className="block text-[11px] font-bold text-text">
              ผู้ให้บริการขนส่ง <span className="font-medium text-muted">(ไม่บังคับ)</span>
              <input
                type="text"
                name="carrier"
                maxLength={80}
                placeholder="เช่น ไปรษณีย์ไทย, Flash"
                className="mt-1.5 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary"
              />
            </label>
            <label className="block text-[11px] font-bold text-text">
              เลขพัสดุ <span className="text-danger">*</span>
              <input
                type="text"
                name="trackingNumber"
                required
                minLength={3}
                maxLength={100}
                autoComplete="off"
                placeholder="กรอกเลขพัสดุ"
                className="mt-1.5 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary"
              />
            </label>
            <TextActionButton className="w-full bg-primary text-white" icon="ship" label="บันทึกการจัดส่ง" />
          </form>
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

function TextActionButton({
  className,
  icon,
  label
}: {
  className: string;
  icon: "prepare" | "ship" | "deliver";
  label: string;
}) {
  const { pending } = useFormStatus();
  const Icon = icon === "prepare" ? PackageCheck : icon === "ship" ? Truck : CheckCircle2;

  return (
    <button
      type="submit"
      className={cn("inline-flex h-10 items-center justify-center gap-2 rounded-[8px] px-4 text-sm font-bold disabled:opacity-60", className)}
      disabled={pending}
    >
      <Icon aria-hidden="true" className="size-4" strokeWidth={2.1} />
      {pending ? "กำลังบันทึก..." : label}
    </button>
  );
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
