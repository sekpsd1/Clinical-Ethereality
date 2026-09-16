"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Copy, Link2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/design-system/variants";
import type { AdminDoctorInvitationItem } from "@/features/admin/users/doctor-invite-queries";
import {
  createDoctorInviteAction,
  revokeDoctorInviteAction,
  type CreateDoctorInviteActionState,
  type RevokeDoctorInviteActionState
} from "@/features/admin/users/doctor-invite-actions";

const initialCreateState: CreateDoctorInviteActionState = { status: "idle", message: "" };
const initialRevokeState: RevokeDoctorInviteActionState = { status: "idle", message: "" };

const statusLabels: Record<AdminDoctorInvitationItem["status"], string> = {
  active: "พร้อมใช้งาน",
  claimed: "เชื่อมบัญชีแล้ว",
  approved: "อนุมัติแพทย์แล้ว",
  expired: "หมดอายุ",
  revoked: "เพิกถอนแล้ว"
};

const statusTones: Record<
  AdminDoctorInvitationItem["status"],
  "neutral" | "success" | "warning" | "danger"
> = {
  active: "success",
  claimed: "warning",
  approved: "success",
  expired: "neutral",
  revoked: "danger"
};

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok"
});

function nextIdempotencyKey(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function AdminDoctorInviteControls({
  invitations,
  initialIdempotencyKey
}: {
  invitations: AdminDoctorInvitationItem[];
  initialIdempotencyKey: string;
}) {
  const [createState, createAction] = useActionState(createDoctorInviteAction, initialCreateState);
  const [idempotencyKey, setIdempotencyKey] = useState(initialIdempotencyKey);
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (createState.status === "success") setIdempotencyKey(nextIdempotencyKey());
  }, [createState.status, createState.inviteUrl]);

  async function copyInviteLink() {
    if (!createState.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(createState.inviteUrl);
      setCopyStatus("success");
    } catch {
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
      setCopyStatus("error");
    }
  }

  return (
    <section className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label font-bold uppercase text-primary">ลิงก์เชิญแพทย์</p>
          <h2 className="mt-1 font-headline text-lg font-bold text-text">เชื่อมเฉพาะบัญชี LINE</h2>
        </div>
        <StatusBadge>24 ชั่วโมง</StatusBadge>
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-muted">
        แพทย์ใช้ลิงก์ได้หนึ่งครั้งเพื่อเชื่อมบัญชี LINE เท่านั้น ยังไม่ได้รับสิทธิ์แพทย์จนกว่าผู้ดูแลจะกรอกข้อมูล อัปโหลดเอกสาร และอนุมัติผ่านฟอร์มเดิม
      </p>

      <form action={createAction} className="mt-4">
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <CreateInviteButton />
      </form>

      {createState.status !== "idle" ? (
        <div
          className={cn(
            "mt-3 rounded-[8px] px-3 py-3 text-xs font-semibold leading-5",
            createState.status === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
          )}
          role="status"
          aria-live="polite"
        >
          <p>{createState.message}</p>
          {createState.inviteUrl ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                ref={linkInputRef}
                readOnly
                aria-label="ลิงก์เชิญแพทย์ที่สร้างล่าสุด"
                value={createState.inviteUrl}
                className="min-h-11 min-w-0 flex-1 rounded-[8px] border border-success/25 bg-white px-3 text-xs text-text"
              />
              <button
                type="button"
                onClick={copyInviteLink}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-primary px-4 text-xs font-bold text-white"
              >
                <Copy aria-hidden="true" className="size-4" />
                คัดลอกลิงก์
              </button>
            </div>
          ) : null}
          {copyStatus === "success" ? <p className="mt-2">คัดลอกลิงก์แล้ว</p> : null}
          {copyStatus === "error" ? <p className="mt-2">คัดลอกอัตโนมัติไม่ได้ กรุณาคัดลอกจากช่องลิงก์</p> : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        <h3 className="text-sm font-bold text-text">สถานะลิงก์ล่าสุด</h3>
        {invitations.length === 0 ? (
          <p className="rounded-[8px] border border-dashed border-border p-4 text-center text-xs font-semibold text-muted">
            ยังไม่มีลิงก์เชิญแพทย์
          </p>
        ) : (
          invitations.map((invitation) => <DoctorInvitationRow key={invitation.id} invitation={invitation} />)
        )}
      </div>
    </section>
  );
}

function CreateInviteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="md" disabled={pending} className="w-full sm:w-auto">
      <Link2 aria-hidden="true" className="size-4" />
      {pending ? "กำลังสร้างลิงก์" : "สร้างลิงก์เชิญแพทย์"}
    </Button>
  );
}

function DoctorInvitationRow({ invitation }: { invitation: AdminDoctorInvitationItem }) {
  const [state, action] = useActionState(revokeDoctorInviteAction, initialRevokeState);
  const canRevoke = invitation.status === "active" || invitation.status === "claimed";

  return (
    <article className="rounded-[8px] border border-border bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 text-xs leading-5 text-muted">
          <p className="font-bold text-text">สร้าง {dateFormatter.format(new Date(invitation.createdAt))}</p>
          <p>หมดอายุ {dateFormatter.format(new Date(invitation.expiresAt))}</p>
          {invitation.claimedByName ? <p className="truncate">บัญชีที่เชื่อม: {invitation.claimedByName}</p> : null}
        </div>
        <StatusBadge tone={statusTones[invitation.status]}>{statusLabels[invitation.status]}</StatusBadge>
      </div>

      {canRevoke ? (
        <form action={action} className="mt-3">
          <input type="hidden" name="invitationId" value={invitation.id} />
          <RevokeInviteButton />
        </form>
      ) : null}
      {state.status !== "idle" ? (
        <p
          className={cn("mt-2 text-xs font-semibold", state.status === "success" ? "text-success" : "text-danger")}
          role="status"
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
    </article>
  );
}

function RevokeInviteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-danger/25 bg-danger/10 px-4 text-xs font-bold text-danger disabled:opacity-60 sm:w-auto"
    >
      <ShieldX aria-hidden="true" className="size-4" />
      {pending ? "กำลังเพิกถอน" : "เพิกถอนลิงก์"}
    </button>
  );
}
