"use client";

import { ChangeEvent, useState } from "react";
import { FileUp, ShoppingCart } from "lucide-react";
import { createExternalPrescriptionOrderAction } from "@/features/products/prescriptions/actions";

type ExternalPrescriptionOrderFormProps = {
  productSlug: string;
};

function formatFileSize(byteSize: number): string {
  if (byteSize < 1024 * 1024) {
    return `${Math.max(1, Math.round(byteSize / 1024))} KB`;
  }

  return `${(byteSize / 1024 / 1024).toFixed(1)} MB`;
}

export function ExternalPrescriptionOrderForm({ productSlug }: ExternalPrescriptionOrderFormProps) {
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFileSize, setSelectedFileSize] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [byteSize, setByteSize] = useState("");
  const [fileName, setFileName] = useState("");

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;

    if (!file) {
      setSelectedFileName("");
      setSelectedFileSize("");
      setByteSize("");
      return;
    }

    setSelectedFileName(file.name);
    setSelectedFileSize(formatFileSize(file.size));
    setFileName(file.name);
    setMimeType(file.type || "application/octet-stream");
    setByteSize(String(file.size));
  }

  return (
    <form action={createExternalPrescriptionOrderAction} className="space-y-3">
      <input type="hidden" name="productSlug" value={productSlug} />
      {byteSize ? <input type="hidden" name="byteSize" value={byteSize} /> : null}

      <div className="rounded-[18px] border border-dashed border-primary/30 bg-primary/5 px-4 py-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-[12px] bg-white px-3 py-2 text-xs font-bold text-primary shadow-chip">
          <FileUp aria-hidden="true" className="size-4" strokeWidth={2.1} />
          เลือกไฟล์ใบสั่งยา
          <input
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="sr-only"
            type="file"
            onChange={handleFileChange}
          />
        </label>
        <p className="mt-2 text-[11px] font-semibold leading-5 text-[#6e797a]">
          {selectedFileName
            ? `เลือกไฟล์แล้ว: ${selectedFileName}${selectedFileSize ? ` (${selectedFileSize})` : ""} ยังไม่อัปโหลดจริง กรุณาใส่ hosted URL หลังอัปโหลด`
            : "ยังไม่ใช่ช่องอัปโหลดไฟล์จริง ใช้เพื่อเตรียม UX ก่อนเชื่อม Cloudinary/S3"}
        </p>
      </div>

      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6e797a]">Prescription file URL</span>
        <input
          required
          type="url"
          name="attachmentUrl"
          placeholder="https://..."
          className="mt-2 h-12 w-full rounded-[16px] border border-[#bdc9ca]/60 bg-white/85 px-4 text-sm font-medium text-[#191c1e] outline-none transition focus:border-primary"
        />
        <span className="mt-2 block text-[11px] leading-5 text-[#6e797a]">
          ใช้ URL จาก storage ที่ได้รับอนุญาต ระบบจะบันทึกเฉพาะ metadata ไม่เก็บไฟล์ในฐานข้อมูล
        </span>
      </label>

      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6e797a]">File name</span>
        <input
          required
          type="text"
          name="fileName"
          value={fileName}
          onChange={(event) => setFileName(event.target.value)}
          placeholder="prescription.pdf"
          className="mt-2 h-12 w-full rounded-[16px] border border-[#bdc9ca]/60 bg-white/85 px-4 text-sm font-medium text-[#191c1e] outline-none transition focus:border-primary"
        />
      </label>

      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6e797a]">File type</span>
        <input
          type="text"
          name="mimeType"
          value={mimeType}
          onChange={(event) => setMimeType(event.target.value)}
          placeholder="application/pdf"
          className="mt-2 h-12 w-full rounded-[16px] border border-[#bdc9ca]/60 bg-white/85 px-4 text-sm font-medium text-[#191c1e] outline-none transition focus:border-primary"
        />
      </label>

      <button
        type="submit"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-gradient px-5 text-sm font-bold leading-5 text-white shadow-booking active:scale-[0.98]"
      >
        <ShoppingCart aria-hidden="true" className="size-5" />
        สั่งซื้อพร้อมใบสั่งยา
      </button>
    </form>
  );
}
