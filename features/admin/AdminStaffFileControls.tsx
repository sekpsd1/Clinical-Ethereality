"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileCheck2, ImageUp, Upload } from "lucide-react";
import { staffFileAccept, type StaffFileKind } from "@/features/staff-files/types";
import { cn } from "@/lib/design-system/variants";

export function AdminStaffFileControls({
  userId,
  userName,
  profilePhotoUrl,
  profilePhotoName,
  licenseProofUrl,
  licenseProofName
}: {
  userId: string;
  userName: string;
  profilePhotoUrl: string | null;
  profilePhotoName: string | null;
  licenseProofUrl: string | null;
  licenseProofName: string | null;
}) {
  return (
    <div className="mt-4 rounded-[8px] border border-border/70 bg-primary/[0.035] p-3">
      <p className="text-xs font-bold text-text">ตรวจสอบเอกสารบุคลากร</p>
      <p className="mt-1 text-[11px] font-semibold leading-5 text-muted">
        ผู้ดูแลระบบเป็นผู้เพิ่มรูปโปรไฟล์ทางการและเอกสารใบอนุญาต ก่อนอนุมัติสิทธิ์บุคลากร
      </p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <UploadForm
          accept={staffFileAccept.profilePhoto}
          currentName={profilePhotoName}
          currentUrl={profilePhotoUrl}
          icon="photo"
          kind="profilePhoto"
          label="รูปโปรไฟล์ทางการ"
          userId={userId}
          userName={userName}
        />
        <UploadForm
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
    </div>
  );
}

function UploadForm({
  accept,
  currentName,
  currentUrl,
  icon,
  kind,
  label,
  userId,
  userName
}: {
  accept: string;
  currentName?: string | null;
  currentUrl: string | null;
  icon: "photo" | "license";
  kind: StaffFileKind;
  label: string;
  userId: string;
  userName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{
    status: "idle" | "success" | "error";
    message: string;
  }>({
    status: "idle",
    message: ""
  });
  const Icon = icon === "photo" ? ImageUp : FileCheck2;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setResult({ status: "idle", message: "" });

    try {
      const response = await fetch("/api/admin/staff-files", {
        method: "POST",
        body: new FormData(form)
      });
      const payload = (await response.json()) as { message?: string };
      const message = payload.message ?? (response.ok ? "อัปโหลดไฟล์แล้ว" : "อัปโหลดไฟล์ไม่สำเร็จ");

      setResult({
        status: response.ok ? "success" : "error",
        message
      });

      if (response.ok) {
        form.reset();
        router.refresh();
      }
    } catch {
      setResult({
        status: "error",
        message: "ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่"
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[8px] border border-border bg-white p-3">
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
      <UploadButton label={currentUrl ? "เปลี่ยนไฟล์" : "อัปโหลด"} pending={pending} />
      {result.status !== "idle" ? (
        <p
          role="status"
          className={cn(
            "mt-2 text-[11px] font-semibold",
            result.status === "success" ? "text-success" : "text-danger"
          )}
        >
          {result.message}
        </p>
      ) : null}
    </form>
  );
}

function UploadButton({ label, pending }: { label: string; pending: boolean }) {
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
