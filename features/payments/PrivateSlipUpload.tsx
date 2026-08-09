"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { CloudUpload, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { paymentSlipMaxBytes, paymentSlipMimeTypes } from "@/features/payments/private-slip-policy";

type PrivateSlipUploadProps =
  | { consultationId: string; paymentId?: never; referenceLabel: string }
  | { consultationId?: never; paymentId: string; referenceLabel: string };

function formatFileSize(byteSize: number): string {
  return byteSize < 1024 * 1024
    ? `${Math.max(1, Math.round(byteSize / 1024))} KB`
    : `${(byteSize / 1024 / 1024).toFixed(1)} MB`;
}

export function PrivateSlipUpload({ consultationId, paymentId, referenceLabel }: PrivateSlipUploadProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;

    if (!nextFile) {
      return;
    }

    if (!paymentSlipMimeTypes.includes(nextFile.type as (typeof paymentSlipMimeTypes)[number])) {
      setFile(null);
      setStatus("error");
      setMessage("รองรับเฉพาะรูป JPG, PNG หรือ WebP");
      return;
    }

    if (nextFile.size === 0 || nextFile.size > paymentSlipMaxBytes) {
      setFile(null);
      setStatus("error");
      setMessage("กรุณาใช้รูปสลิปขนาดไม่เกิน 5 MB");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(URL.createObjectURL(nextFile));
    setFile(nextFile);
    setStatus("idle");
    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setStatus("error");
      setMessage("กรุณาเลือกรูปสลิปก่อนส่ง");
      return;
    }

    setStatus("submitting");
    setMessage("กำลังส่งสลิปเข้าเก็บแบบส่วนตัว");
    const formData = new FormData();
    formData.set("file", file);

    if (paymentId) {
      formData.set("paymentId", paymentId);
    } else if (consultationId) {
      formData.set("consultationId", consultationId);
    }

    try {
      const response = await fetch("/api/payments/private-slip", { method: "POST", body: formData });
      const payload = (await response.json().catch(() => null)) as { error?: string; ok?: boolean } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "ไม่สามารถส่งสลิปได้");
      }

      setStatus("success");
      setMessage("ได้รับสลิปแล้ว และส่งเข้าคิวให้ทีมงานตรวจสอบ");
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "ไม่สามารถส่งสลิปได้");
    }
  }

  const isBusy = status === "submitting";

  return (
    <form onSubmit={handleSubmit} className="mt-6 rounded-[22px] border border-dashed border-teal-200/80 bg-white/80 p-5 shadow-[0_10px_26px_rgba(0,96,103,0.05)]">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-primary">
          <ShieldCheck aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-primary">ส่งสลิปเพื่อรอตรวจสอบ</p>
          <p className="mt-1 text-xs leading-5 text-[#3e494a]">{referenceLabel} • เก็บในพื้นที่ส่วนตัวของคลินิก ไม่เปิดเป็นลิงก์สาธารณะ</p>
        </div>
      </div>

      <label className="mt-4 flex min-h-[132px] cursor-pointer flex-col items-center justify-center rounded-[18px] bg-teal-50/70 px-4 py-5 text-center text-primary ring-1 ring-teal-100">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="ตัวอย่างรูปสลิปที่เลือก" className="mb-3 max-h-28 rounded-[14px] object-contain" />
        ) : (
          <CloudUpload aria-hidden="true" className="mb-3 size-8" />
        )}
        <span className="text-sm font-bold">{file?.name ?? "เลือกรูปสลิปการโอนเงิน"}</span>
        {file ? <span className="mt-1 text-[11px] font-semibold text-[#3e494a]">{formatFileSize(file.size)}</span> : null}
        <span className="mt-2 text-[11px] font-semibold leading-5 text-[#6e797a]">รองรับ JPG, PNG, WebP • ไม่เกิน 5 MB</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} disabled={isBusy} />
      </label>

      {message ? (
        <p className={`mt-4 text-xs font-semibold leading-5 ${status === "error" ? "text-[#93000a]" : status === "success" ? "text-primary" : "text-[#3e494a]"}`}>
          {message}
        </p>
      ) : null}

      <button type="submit" disabled={isBusy} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-gradient text-sm font-extrabold text-white shadow-[0_12px_24px_-8px_rgba(0,96,103,0.4)] disabled:cursor-not-allowed disabled:opacity-60">
        {isBusy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
        {isBusy ? "กำลังส่งสลิป" : "ส่งสลิปเพื่อรอตรวจสอบ"}
      </button>
    </form>
  );
}
