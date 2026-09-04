"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { CheckCircle2, Save, XCircle } from "lucide-react";
import {
  updateUserRoleAction,
  updateUserStatusAction
} from "@/features/admin/users/actions";
import { cn } from "@/lib/design-system/variants";
import type { AdminUserActionState } from "@/features/admin/users/actions";
import type { AdminUserApprovalItem } from "@/features/admin/users/types";

type AdminUserActionButtonsProps = {
  user: Pick<AdminUserApprovalItem, "id" | "name" | "currentRole" | "requestedRole" | "status" | "staffStatus">;
  isCurrentUser: boolean;
  redirectOnRoleChange?: Route;
};

const initialActionState: AdminUserActionState = {
  status: "idle",
  message: ""
};

export function AdminUserActionButtons({ user, isCurrentUser, redirectOnRoleChange }: AdminUserActionButtonsProps) {
  const router = useRouter();
  const isStaffRoleRequest = user.requestedRole === "doctor" || user.requestedRole === "pharmacist";
  const isPendingApproval = user.status === "pending_review" || user.staffStatus === "pending_review";
  const [suspendState, suspendAction] = useActionState(updateUserStatusAction, initialActionState);
  const [approveState, setApproveState] = useState<AdminUserActionState>(initialActionState);
  const [approvePending, setApprovePending] = useState(false);
  const [roleState, roleAction] = useActionState(updateUserRoleAction, initialActionState);
  const actionState =
    roleState.status !== "idle" ? roleState : approveState.status !== "idle" ? approveState : suspendState;

  useEffect(() => {
    if (roleState.status === "success" && redirectOnRoleChange) {
      router.push(redirectOnRoleChange);
    }
  }, [redirectOnRoleChange, roleState.status, router]);

  async function handleApprove() {
    setApprovePending(true);
    setApproveState(initialActionState);

    try {
      const response = await fetch("/api/admin/users/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: user.id,
          role: user.requestedRole
        })
      });
      const payload = (await response.json()) as { message?: string };

      setApproveState({
        status: response.ok ? "success" : "error",
        message: payload.message ?? (response.ok ? "อนุมัติสิทธิ์เรียบร้อยแล้ว" : "ไม่สามารถอนุมัติสิทธิ์ได้")
      });

      if (response.ok) {
        router.refresh();
      }
    } catch {
      setApproveState({
        status: "error",
        message: "ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่"
      });
    } finally {
      setApprovePending(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col items-end gap-2">
      {isCurrentUser ? (
        <p className="text-right text-[11px] font-semibold leading-4 text-muted">
          บัญชีที่กำลังใช้งาน ไม่สามารถเปลี่ยนสิทธิ์ตนเองได้
        </p>
      ) : (
        <>
          <div className="flex w-full max-w-[480px] flex-wrap items-end justify-end gap-2">
            <form action={roleAction} className="flex min-w-[240px] flex-1 items-end gap-2">
              <input type="hidden" name="userId" value={user.id} />
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-left text-[11px] font-bold text-muted">เปลี่ยนสิทธิ์</span>
                <select
                  name="role"
                  defaultValue={user.currentRole}
                  className="h-9 w-full rounded-[8px] border border-border bg-white px-2 text-xs font-semibold text-text outline-none focus:border-primary"
                  aria-label={`เลือกสิทธิ์ของ ${user.name}`}
                >
                  <option value="customer">ลูกค้า</option>
                  <option value="doctor">แพทย์</option>
                  <option value="pharmacist">เภสัชกร</option>
                  <option value="admin">ผู้ดูแลระบบ</option>
                </select>
              </label>
              <SaveRoleButton userName={user.name} />
            </form>

            {user.status === "active" || isPendingApproval ? (
              <div className="flex gap-2">
                <form action={suspendAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="status" value="suspended" />
                  <ActionIconButton
                    ariaLabel={
                      isPendingApproval ? `ไม่อนุมัติคำขอสิทธิ์ของ ${user.name}` : `ระงับบัญชี ${user.name}`
                    }
                    className="border border-danger/20 bg-danger/10 text-danger"
                    icon="suspend"
                    title={isPendingApproval ? "ไม่อนุมัติคำขอสิทธิ์" : "ระงับบัญชี"}
                  />
                </form>
                {isPendingApproval && user.requestedRole !== "customer" ? (
                  <ActionIconButton
                    ariaLabel={`อนุมัติ ${user.name}`}
                    className="bg-primary text-white"
                    icon="approve"
                    onClick={handleApprove}
                    pendingOverride={approvePending}
                    title="อนุมัติการเปลี่ยนสิทธิ์"
                    type="button"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
          {isPendingApproval && isStaffRoleRequest ? (
            <p className="max-w-[480px] text-right text-[11px] font-semibold leading-5 text-muted">
              สำหรับคำขอสิทธิ์แพทย์หรือเภสัชกร: ปุ่มกากบาทสีแดงคือไม่อนุมัติคำขอ และปุ่มเครื่องหมายถูกสีเขียวคืออนุมัติการเปลี่ยนสิทธิ์ตาม “สิทธิ์ที่ขอ”
            </p>
          ) : null}
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
  icon,
  onClick,
  pendingOverride,
  title,
  type = "submit"
}: {
  ariaLabel: string;
  className: string;
  icon: "approve" | "suspend";
  onClick?: () => void;
  pendingOverride?: boolean;
  title: string;
  type?: "button" | "submit";
}) {
  const { pending } = useFormStatus();
  const Icon = icon === "approve" ? CheckCircle2 : XCircle;

  return (
    <button
      type={type}
      className={cn("inline-flex size-9 items-center justify-center rounded-full disabled:opacity-60", className)}
      aria-label={ariaLabel}
      disabled={pendingOverride ?? pending}
      onClick={onClick}
      title={title}
    >
      <Icon aria-hidden="true" className="size-4" strokeWidth={2.1} />
    </button>
  );
}
