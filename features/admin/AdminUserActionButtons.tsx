"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { approveStaffRoleAction, updateUserStatusAction } from "@/features/admin/users/actions";
import { cn } from "@/lib/design-system/variants";
import type { AdminUserActionState } from "@/features/admin/users/actions";
import type { AdminUserApprovalItem } from "@/features/admin/users/types";

type AdminUserActionButtonsProps = {
  user: Pick<AdminUserApprovalItem, "id" | "name" | "requestedRole">;
};

const initialActionState: AdminUserActionState = {
  status: "idle",
  message: ""
};

export function AdminUserActionButtons({ user }: AdminUserActionButtonsProps) {
  const [suspendState, suspendAction] = useActionState(updateUserStatusAction, initialActionState);
  const [approveState, approveAction] = useActionState(approveStaffRoleAction, initialActionState);
  const actionState = approveState.status !== "idle" ? approveState : suspendState;

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
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
      {actionState.status !== "idle" ? (
        <p
          className={cn(
            "max-w-[160px] text-right text-[11px] font-semibold leading-4",
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
