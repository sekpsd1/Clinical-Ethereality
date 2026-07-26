"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Save, XCircle } from "lucide-react";
import {
  approveStaffRoleAction,
  updateUserRoleAction,
  updateUserStatusAction
} from "@/features/admin/users/actions";
import { cn } from "@/lib/design-system/variants";
import type { AdminUserActionState } from "@/features/admin/users/actions";
import type { AdminUserApprovalItem } from "@/features/admin/users/types";

type AdminUserActionButtonsProps = {
  user: Pick<AdminUserApprovalItem, "id" | "name" | "currentRole" | "requestedRole" | "status">;
  isCurrentUser: boolean;
};

const initialActionState: AdminUserActionState = {
  status: "idle",
  message: ""
};

export function AdminUserActionButtons({ user, isCurrentUser }: AdminUserActionButtonsProps) {
  const [suspendState, suspendAction] = useActionState(updateUserStatusAction, initialActionState);
  const [approveState, approveAction] = useActionState(approveStaffRoleAction, initialActionState);
  const [roleState, roleAction] = useActionState(updateUserRoleAction, initialActionState);
  const actionState =
    roleState.status !== "idle" ? roleState : approveState.status !== "idle" ? approveState : suspendState;

  return (
    <div className="flex min-w-0 flex-1 flex-col items-end gap-2">
      {isCurrentUser ? (
        <p className="text-right text-[11px] font-semibold leading-4 text-muted">
          บัญชีที่กำลังใช้งาน ไม่สามารถเปลี่ยนสิทธิ์ตนเองได้
        </p>
      ) : (
        <>
          {user.status === "active" && (user.currentRole === "customer" || user.currentRole === "admin") ? (
            <form action={roleAction} className="flex w-full max-w-[320px] items-end gap-2">
              <input type="hidden" name="userId" value={user.id} />
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-left text-[11px] font-bold text-muted">เปลี่ยนสิทธิ์</span>
                <select
                  name="role"
                  defaultValue={user.currentRole === "admin" ? "admin" : "customer"}
                  className="h-9 w-full rounded-[8px] border border-border bg-white px-2 text-xs font-semibold text-text outline-none focus:border-primary"
                  aria-label={`เลือกสิทธิ์ของ ${user.name}`}
                >
                  <option value="customer">ลูกค้า</option>
                  <option value="admin">ผู้ดูแลระบบ</option>
                </select>
              </label>
              <SaveRoleButton userName={user.name} />
            </form>
          ) : null}

          <div className="flex gap-2">
            <form action={suspendAction}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="status" value="suspended" />
              <ActionIconButton
                ariaLabel={`ระงับบัญชี ${user.name}`}
                className="border border-danger/20 bg-danger/10 text-danger"
                icon="suspend"
              />
            </form>
            {user.requestedRole !== "customer" ? (
              <form action={approveAction}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="role" value={user.requestedRole} />
                <ActionIconButton ariaLabel={`อนุมัติ ${user.name}`} className="bg-primary text-white" icon="approve" />
              </form>
            ) : null}
          </div>
        </>
      )}
      {actionState.status !== "idle" ? (
        <p
          className={cn(
            "max-w-[320px] text-right text-[11px] font-semibold leading-4",
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

function SaveRoleButton({ userName }: { userName: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] bg-primary px-3 text-xs font-bold text-white disabled:opacity-60"
      aria-label={`บันทึกสิทธิ์ของ ${userName}`}
      disabled={pending}
    >
      <Save aria-hidden="true" className="size-4" strokeWidth={2.1} />
      <span>{pending ? "กำลังบันทึก" : "บันทึก"}</span>
    </button>
  );
}

function ActionIconButton({
  ariaLabel,
  className,
  icon
}: {
  ariaLabel: string;
  className: string;
  icon: "approve" | "suspend";
}) {
  const { pending } = useFormStatus();
  const Icon = icon === "approve" ? CheckCircle2 : XCircle;

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
