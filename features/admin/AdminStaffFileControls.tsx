"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ExternalLink, FileCheck2, ImageUp, Upload } from "lucide-react";
import { uploadStaffFileAction, type AdminUserActionState } from "@/features/admin/users/actions";
import { staffFileAccept, type StaffFileKind } from "@/features/staff-files/types";
import { cn } from "@/lib/design-system/variants";

const initialState: AdminUserActionState = {
  status: "idle",
  message: ""
};

export function AdminStaffFileControls({
  userId,
  userName,
  profilePhotoUrl,
  licenseProofUrl,
  licenseProofName
}: {
  userId: string;
  userName: string;
  profilePhotoUrl: string | null;
  licenseProofUrl: string | null;
  licenseProofName: string | null;
}) {
  const [photoState, photoAction] = useActionState(uploadStaffFileAction, initialState);
  const [licenseState, licenseAction] = useActionState(uploadStaffFileAction, initialState);
  const actionState = licenseState.status !== "idle" ? licenseState : photoState;

  return (
    <div className="mt-4 rounded-[8px] border border-border/70 bg-primary/[0.035] p-3">
      <p className="text-xs font-bold text-text">ตรวจสอบเอกสารบุคลากร</p>
      <p className="mt-1 text-[11px] font-semibold leading-5 text-muted">
        เปิดตรวจรูปและใบอนุญาตก่อนอนุมัติ หากข้อมูลไม่ถูกต้องสามารถอัปโหลดไฟล์ทดแทนได้
      </p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <UploadForm
          action={photoAction}
          accept={staffFileAccept.profilePhoto}
          currentUrl={profilePhotoUrl}
          icon="photo"
          kind="profilePhoto"
          label="รูปโปรไฟล์ทางการ"
          userId={userId}
          userName={userName}
        />
        <UploadForm
          action={licenseAction}
          accept={staffFileAccept.licenseProof}
          currentName={licenseProofName}
          currentUrl={licenseProofUrl}
          icon="license"
          kind="licenseProof"
          label="เอกสารใบอนุญาต"
          userId={userId}
          userName={userName}
        />
      </div>
      {actionState.status !== "idle" ? (
        <p
          role="status"
          className={cn(
            "mt-3 text-xs font-semibold",
            actionState.status === "success" ? "text-success" : "text-danger"
          )}
        >
          {actionState.message}
        </p>
      ) : null}
    </div>
  );
}

function UploadForm({
  action,
  accept,
  currentName,
  currentUrl,
  icon,
  kind,
  label,
  userId,
  userName
}: {
  action: (payload: FormData) => void;
  accept: string;
  currentName?: string | null;
  currentUrl: string | null;
  icon: "photo" | "license";
  kind: StaffFileKind;
  label: string;
  userId: string;
  userName: string;
}) {
  const Icon = icon === "photo" ? ImageUp : FileCheck2;

  return (
    <form action={action} className="rounded-[8px] border border-border bg-white p-3">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="kind" value={kind} />
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-bold text-text">
          <Icon aria-hidden="true" className="size-4 text-primary" />
          {label}
        </span>
        {currentUrl ? (
          <a
            href={currentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary"
          >
            เปิดตรวจสอบ
            <ExternalLink aria-hidden="true" className="size-3" />
          </a>
        ) : null}
      </div>
      {currentName ? <p className="mt-1 truncate text-[10px] font-semibold text-muted">{currentName}</p> : null}
      <input
        type="file"
        name="file"
        accept={accept}
        required
        aria-label={`${label}ของ ${userName}`}
        className="mt-3 block w-full text-[11px] text-muted file:mr-2 file:rounded-full file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:font-bold file:text-primary"
      />
      <UploadButton label={currentUrl ? "เปลี่ยนไฟล์" : "อัปโหลด"} />
    </form>
  );
}

function UploadButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] bg-primary px-3 text-xs font-bold text-white disabled:opacity-60"
    >
      <Upload aria-hidden="true" className="size-4" />
      {pending ? "กำลังอัปโหลด" : label}
    </button>
  );
}
