"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { SendHorizontal } from "lucide-react";
import { createNotificationAction } from "@/features/admin/notifications/actions";
import { cn } from "@/lib/design-system/variants";
import type { AdminNotificationActionState } from "@/features/admin/notifications/actions";
import type { AdminNotificationRecipient } from "@/features/admin/notifications/types";

const initialActionState: AdminNotificationActionState = {
  status: "idle",
  message: ""
};

export function AdminNotificationForm({ recipients }: { recipients: AdminNotificationRecipient[] }) {
  const [state, action] = useActionState(createNotificationAction, initialActionState);

  return (
    <form action={action} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      <div className="grid gap-3">
        <label>
          <span className="block text-[10px] font-bold uppercase text-muted">ผู้รับ</span>
          <select
            className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-bold text-text outline-none transition focus:border-primary"
            disabled={recipients.length === 0}
            name="userId"
          >
            {recipients.map((recipient) => (
              <option key={recipient.id} value={recipient.id}>
                {recipient.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="block text-[10px] font-bold uppercase text-muted">ประเภท</span>
          <select
            className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-bold text-text outline-none transition focus:border-primary"
            defaultValue="system"
            name="type"
          >
            <option value="system">ระบบ</option>
            <option value="consultation">การปรึกษา</option>
            <option value="order">คำสั่งซื้อ</option>
            <option value="payment">การชำระเงิน</option>
            <option value="prescription">ใบสั่งยา</option>
            <option value="community">ชุมชน</option>
            <option value="reward">แต้มสะสม</option>
          </select>
        </label>
        <TextField label="หัวข้อ" name="title" placeholder="หัวข้อการแจ้งเตือน" />
        <label>
          <span className="block text-[10px] font-bold uppercase text-muted">เนื้อหา</span>
          <textarea
            className="mt-1 min-h-20 w-full resize-none rounded-[8px] border border-border bg-white px-3 py-2 text-sm leading-5 text-text outline-none transition focus:border-primary"
            name="body"
            placeholder="ข้อความที่จะแสดงในศูนย์การแจ้งเตือน"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
        <p
          className={cn(
            "min-w-0 text-[11px] font-semibold leading-4",
            state.status === "success" ? "text-success" : state.status === "error" ? "text-danger" : "text-muted"
          )}
          role="status"
        >
          {state.message || "สร้างการแจ้งเตือนในแอปให้ผู้ใช้ที่เลือก"}
        </p>
        <SubmitButton disabled={recipients.length === 0} />
      </div>
    </form>
  );
}

function TextField({ label, name, placeholder }: { label: string; name: string; placeholder: string }) {
  return (
    <label>
      <span className="block text-[10px] font-bold uppercase text-muted">{label}</span>
      <input
        className="mt-1 h-10 w-full rounded-[8px] border border-border bg-white px-3 text-sm font-bold text-text outline-none transition focus:border-primary"
        name={name}
        placeholder={placeholder}
        type="text"
      />
    </label>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-60"
      aria-label="ส่งการแจ้งเตือน"
      disabled={disabled || pending}
    >
      <SendHorizontal aria-hidden="true" className="size-4" strokeWidth={2.1} />
    </button>
  );
}
