"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

const buttonClass = "flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-3 text-center text-sm font-bold text-primary ring-1 ring-primary/20 disabled:opacity-60";

export function OrderReceiptDownload({ orderId, orderCode }: { orderId: string; orderCode: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function prepare() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/receipt`, {
        credentials: "same-origin",
        cache: "no-store"
      });
      if (!response.ok || response.headers.get("Content-Type")?.split(";")[0] !== "application/pdf") {
        throw new Error("Receipt unavailable");
      }
      const pdf = await response.blob();
      if (await pdf.slice(0, 5).text() !== "%PDF-") throw new Error("Invalid PDF");
      setFile(new File([pdf], `receipt-${orderCode}.pdf`, { type: "application/pdf" }));
      setMessage("ไฟล์ PDF พร้อมแล้ว");
    } catch {
      setMessage("เตรียมไฟล์ PDF ไม่สำเร็จ กรุณาลองใหม่ หรือเลือกดูใบเสร็จในแอป");
    } finally {
      setLoading(false);
    }
  }

  async function shareFile(preparedFile: File) {
    try {
      await navigator.share({ files: [preparedFile] });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("แชร์ไฟล์ไม่สำเร็จ กรุณาเลือกบันทึก PDF");
    }
  }

  return (
    <div className="space-y-3">
      {file && downloadUrl ? (
        <>
          <a href={downloadUrl} download={file.name} className={buttonClass}>
            <Download aria-hidden="true" className="size-5 shrink-0" />
            บันทึก PDF
          </a>
          {typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] }) ? (
            <button type="button" onClick={() => void shareFile(file)} className={buttonClass}>แชร์ไฟล์ PDF</button>
          ) : null}
        </>
      ) : (
        <button type="button" onClick={() => void prepare()} disabled={loading} className={buttonClass}>
          <Download aria-hidden="true" className="size-5 shrink-0" />
          {loading ? "กำลังเตรียมไฟล์ PDF…" : "ดาวน์โหลดใบเสร็จ (PDF)"}
        </button>
      )}
      <p role="status" className="text-sm text-[#3e494a] empty:hidden">{message}</p>
    </div>
  );
}
