"use client";

import { useActionState } from "react";
import { XCircle } from "lucide-react";
import {
  cancelCustomerOrderAction,
  type CustomerOrderCancellationActionState
} from "@/features/orders/actions";
import { cn } from "@/lib/design-system/variants";

const initialState: CustomerOrderCancellationActionState = {
  status: "idle",
  message: ""
};

export function CustomerOrderCancellation({
  orderId,
  orderCode
}: {
  orderId: string;
  orderCode: string;
}) {
  const [state, action, isPending] = useActionState(cancelCustomerOrderAction, initialState);

  return (
    <section className="rounded-[24px] border border-danger/20 bg-white/75 p-5 shadow-[0_10px_30px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <h2 className="text-base font-extrabold text-[#191c1e]">ยังไม่ได้ชำระเงินใช่ไหม?</h2>
      <p className="mt-2 text-sm leading-6 text-[#6e797a]">
        ยกเลิกได้ก่อนส่งข้อมูลชำระเงิน ระบบจะคืนสต็อกที่สำรองไว้และเก็บรายการนี้ในประวัติคำสั่งซื้อ
      </p>

      <form
        action={action}
        className="mt-4"
        onSubmit={(event) => {
          if (!window.confirm(`ยืนยันยกเลิกคำสั่งซื้อ ${orderCode} ใช่ไหม?`)) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="orderId" value={orderId} />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[12px] border border-danger/30 bg-danger/5 px-4 text-sm font-bold text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <XCircle aria-hidden="true" className="size-4" strokeWidth={2.2} />
          {isPending ? "กำลังยกเลิก..." : "ยกเลิกคำสั่งซื้อ"}
        </button>
      </form>

      {state.status !== "idle" ? (
        <p
          className={cn(
            "mt-3 text-xs font-semibold leading-5",
            state.status === "success" ? "text-success" : "text-danger"
          )}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
