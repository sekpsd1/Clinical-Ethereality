"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ExternalLink, ShieldCheck } from "lucide-react";
import {
  reviewConsultationPaymentAction,
  reviewManualAppointmentPaymentAction,
  type AdminPaymentActionState
} from "@/features/admin/payments/actions";
import type { AdminPaymentQueueItem } from "@/features/admin/payments/types";
import { cn } from "@/lib/design-system/variants";

const initialState: AdminPaymentActionState = { status: "idle", message: "" };

export function AdminConsultationPaymentReviewForm({
  payment
}: {
  payment: AdminPaymentQueueItem;
}) {
  const review = payment.consultationManualReview;
  const [state, action] = useActionState(
    reviewConsultationPaymentAction,
    initialState
  );

  if (!review) return null;

  if (!review.eligible) {
    return (
      <p className="mt-4 rounded-[8px] border border-warning/20 bg-warning/10 px-3 py-2 text-xs font-semibold leading-5 text-muted">
        {review.reason}
      </p>
    );
  }

  if (review.kind === "manual_appointment") {
    return <ManualAppointmentDecisionForm payment={payment} />;
  }

  return (
    <form
      action={action}
      className="mt-4 space-y-3 border-t border-border/70 pt-4"
    >
      <input type="hidden" name="paymentId" value={payment.id} />
      <input type="hidden" name="amount" value={payment.amountInput} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-primary">
            ตรวจรายการโอนค่าปรึกษา
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">{review.reason}</p>
        </div>
        {review.slipHref ? (
          <a
            href={review.slipHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-3 py-2 text-xs font-bold text-primary"
          >
            ดูสลิป
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : null}
      </div>

      <label className="block text-xs font-bold text-muted">
        เลขอ้างอิงธนาคาร
        <input
          required
          name="transactionReference"
          maxLength={255}
          autoComplete="off"
          className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold text-muted">
          วันเวลาโอน (ประเทศไทย)
          <input
            required
            type="datetime-local"
            name="transferredAt"
            className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary"
          />
        </label>
        <label className="block text-xs font-bold text-muted">
          เวลาที่ลูกค้าติดต่อ LINE OA
          <input
            required
            type="datetime-local"
            name="customerReportedAt"
            className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary"
          />
        </label>
      </div>

      <label className="block text-xs font-bold text-muted">
        เหตุผลที่ใช้ Manual Review
        <select
          required
          name="reasonCode"
          defaultValue="provider_unavailable"
          className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary"
        >
          <option value="provider_unavailable">ผู้ให้บริการไม่พร้อมใช้งาน</option>
          <option value="provider_timeout">ผู้ให้บริการหมดเวลา</option>
          <option value="provider_result_ambiguous">ผลจากผู้ให้บริการไม่ชัดเจน</option>
        </select>
      </label>

      <label className="flex items-start gap-2 rounded-[8px] bg-primary/5 p-3 text-xs font-semibold leading-5 text-muted">
        <input
          required
          type="checkbox"
          name="confirmedExternalBankCheck"
          value="true"
          className="mt-1 size-4 accent-primary"
        />
        ตรวจรายการเงินจริงจากธนาคารภายนอกแล้ว ยอดตรงกับ {payment.amount}
        และลูกค้าติดต่อ LINE OA ภายใน 24 ชั่วโมง
      </label>

      <SubmitButton />
      {state.status !== "idle" ? (
        <p
          role="status"
          className={cn(
            "text-xs font-semibold leading-5",
            state.status === "success" ? "text-success" : "text-danger"
          )}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function ManualAppointmentDecisionForm({
  payment
}: {
  payment: AdminPaymentQueueItem;
}) {
  const review = payment.consultationManualReview!;
  const [approveState, approveAction] = useActionState(
    reviewManualAppointmentPaymentAction,
    initialState
  );
  const [rejectState, rejectAction] = useActionState(
    reviewManualAppointmentPaymentAction,
    initialState
  );

  return (
    <div className="mt-4 space-y-4 border-t border-border/70 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-primary">
            ตรวจรายการโอนสำหรับนัดที่ Admin รับเรื่อง
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">{review.reason}</p>
        </div>
        {review.slipHref ? (
          <a
            href={review.slipHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-3 py-2 text-xs font-bold text-primary"
          >
            ดูสลิป
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : null}
      </div>

      <form action={approveAction} className="space-y-3">
        <input type="hidden" name="paymentId" value={payment.id} />
        <input type="hidden" name="decision" value="verified" />
        <label className="block text-xs font-bold text-muted">
          เลขอ้างอิงธนาคาร
          <input
            required
            name="transactionReference"
            maxLength={255}
            autoComplete="off"
            className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary"
          />
        </label>
        <label className="flex items-start gap-2 rounded-[8px] bg-primary/5 p-3 text-xs font-semibold leading-5 text-muted">
          <input
            required
            type="checkbox"
            name="confirmedExternalBankCheck"
            value="true"
            className="mt-1 size-4 accent-primary"
          />
          ตรวจรายการเงินจริงจากธนาคารภายนอกแล้ว ยอดตรงกับ {payment.amount}
          และหลักฐานเชื่อมกับผู้ป่วยรายนี้
        </label>
        <DecisionSubmitButton label="ยืนยันรายการโอนและนัดหมาย" />
        <ActionMessage state={approveState} />
      </form>

      <form
        action={rejectAction}
        className="space-y-3 rounded-[8px] border border-danger/20 bg-danger/5 p-3"
      >
        <input type="hidden" name="paymentId" value={payment.id} />
        <input type="hidden" name="decision" value="rejected" />
        <label className="block text-xs font-bold text-muted">
          เหตุผลที่ปฏิเสธ
          <select
            required
            name="rejectionReasonCode"
            defaultValue="bank_transfer_not_found"
            className="mt-1 h-11 w-full rounded-[8px] border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary"
          >
            <option value="bank_transfer_not_found">ไม่พบรายการโอนในธนาคาร</option>
            <option value="amount_mismatch">ยอดเงินไม่ตรง</option>
            <option value="evidence_invalid">หลักฐานไม่ถูกต้อง</option>
            <option value="duplicate_transaction_reference">รายการอ้างอิงซ้ำ</option>
          </select>
        </label>
        <label className="flex items-start gap-2 text-xs font-semibold leading-5 text-muted">
          <input
            required
            type="checkbox"
            name="confirmedRejection"
            value="true"
            className="mt-1 size-4 accent-danger"
          />
          ยืนยันการปฏิเสธและยกเลิกคำขอนัดหมาย พร้อมปล่อยช่วงเวลา
        </label>
        <DecisionSubmitButton label="ปฏิเสธรายการ" danger />
        <ActionMessage state={rejectState} />
      </form>
    </div>
  );
}

function DecisionSubmitButton({
  danger = false,
  label
}: {
  danger?: boolean;
  label: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-bold text-white disabled:opacity-60",
        danger ? "bg-danger" : "bg-primary"
      )}
    >
      <ShieldCheck aria-hidden="true" className="size-4" />
      {pending ? "กำลังบันทึก..." : label}
    </button>
  );
}

function ActionMessage({ state }: { state: AdminPaymentActionState }) {
  return state.status !== "idle" ? (
    <p
      role="status"
      className={cn(
        "text-xs font-semibold leading-5",
        state.status === "success" ? "text-success" : "text-danger"
      )}
    >
      {state.message}
    </p>
  ) : null;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-white disabled:opacity-60"
    >
      <ShieldCheck aria-hidden="true" className="size-4" />
      {pending ? "กำลังตรวจสอบ..." : "ยืนยันจากรายการธนาคาร"}
    </button>
  );
}
