"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, Loader2, ScanLine } from "lucide-react";

type CustomerSlipVerificationProps = {
  paymentId: string;
  orderCode: string;
};

type BarcodeDetectorLike = {
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function getBarcodeDetector(): BarcodeDetectorConstructor | null {
  const candidate = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;

  return candidate ?? null;
}

export function CustomerSlipVerification({ paymentId, orderCode }: CustomerSlipVerificationProps) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "reading" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFileName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
    setStatus("reading");
    setMessage("กำลังอ่าน QR จากรูปสลิปนี้");

    const BarcodeDetector = getBarcodeDetector();

    if (!BarcodeDetector) {
      setStatus("idle");
      setMessage("เบราว์เซอร์นี้อ่าน QR อัตโนมัติไม่ได้ กรุณาวาง QR payload หรือ hosted slip URL ด้านล่าง");
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      const codes = await detector.detect(bitmap);
      const nextPayload = codes.find((code) => code.rawValue)?.rawValue ?? "";
      bitmap.close();

      if (!nextPayload) {
        setStatus("idle");
        setMessage("ไม่พบ QR ในสลิปนี้ กรุณาใช้รูปที่ชัดขึ้นหรือวาง payload เอง");
        return;
      }

      setQrPayload(nextPayload);
      setStatus("idle");
      setMessage("พบ QR ของสลิปแล้ว กดส่งเพื่อตรวจสอบการชำระเงิน");
    } catch {
      setStatus("idle");
      setMessage("อ่านรูปสลิปไม่ได้ กรุณาใช้รูปที่ชัดขึ้นหรือวาง payload เอง");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedPayload = qrPayload.trim();
    const trimmedImageUrl = imageUrl.trim();

    if (!trimmedPayload && !trimmedImageUrl) {
      setStatus("error");
      setMessage("กรุณาอัปโหลดสลิปที่อ่านได้ วาง QR payload หรือใส่ hosted slip image URL");
      return;
    }

    setStatus("submitting");
    setMessage("กำลังตรวจสอบสลิปกับ provider ที่ตั้งค่าไว้");

    try {
      const response = await fetch("/api/payments/verify-slip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          paymentId,
          qrPayload: trimmedPayload || undefined,
          imageUrl: trimmedImageUrl || undefined
        })
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "ตรวจสอบสลิปไม่สำเร็จ");
      }

      if (!payload?.ok) {
        setStatus("error");
        setMessage("provider ปฏิเสธสลิปนี้ กรุณาตรวจสอบยอดเงิน ผู้รับเงิน และรูปสลิป");
        router.refresh();
        return;
      }

      setStatus("success");
      setMessage("ยืนยันการชำระเงินแล้ว คลินิกสามารถเริ่มเตรียมสินค้าได้");
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Slip verification provider ยังไม่พร้อมใช้งาน");
    }
  }

  const isBusy = status === "reading" || status === "submitting";

  return (
    <form onSubmit={handleSubmit} className="mt-6 rounded-[22px] border border-dashed border-teal-200/80 bg-white/80 p-5 shadow-[0_10px_26px_rgba(0,96,103,0.05)]">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-primary">
          <ScanLine aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-primary">ตรวจสอบสลิป PromptPay</p>
          <p className="mt-1 text-xs leading-5 text-[#3e494a]">{orderCode} รอตรวจสอบสลิปการชำระเงิน</p>
        </div>
      </div>

      <label className="mt-4 flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-[18px] bg-teal-50/70 px-4 py-5 text-center text-primary ring-1 ring-teal-100">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="mb-3 max-h-28 rounded-[14px] object-contain" />
        ) : (
          <CloudUpload aria-hidden="true" className="mb-3 size-8" />
        )}
        <span className="text-sm font-bold">{fileName ?? "อัปโหลดสลิปโอนเงิน"}</span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#3e494a]">
          อ่าน QR ในเครื่องก่อนส่งไปตรวจสอบกับ provider
        </span>
        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isBusy} />
      </label>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6e797a]">Slip QR payload</span>
          <textarea
            value={qrPayload}
            onChange={(event) => setQrPayload(event.target.value)}
            rows={3}
            className="mt-2 w-full resize-none rounded-[16px] border border-[#bdc9ca]/30 bg-white px-4 py-3 text-xs leading-5 text-[#191c1e] outline-none focus:border-primary"
            placeholder="ระบบจะเติมให้อัตโนมัติเมื่อรูปสลิปมี QR ที่อ่านได้"
            disabled={isBusy}
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6e797a]">Hosted slip image URL</span>
          <input
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            className="mt-2 h-11 w-full rounded-[16px] border border-[#bdc9ca]/30 bg-white px-4 text-xs text-[#191c1e] outline-none focus:border-primary"
            placeholder="https://..."
            disabled={isBusy}
          />
          <span className="mt-2 block text-[11px] leading-5 text-[#6e797a]">
            ถ้าใส่ URL ระบบจะบันทึกเป็น metadata ของไฟล์สลิปและตรวจว่าอยู่ใน storage base URL ที่ตั้งไว้
          </span>
        </label>
      </div>

      {message ? (
        <p className={`mt-4 text-xs font-semibold leading-5 ${status === "error" ? "text-[#93000a]" : status === "success" ? "text-primary" : "text-[#3e494a]"}`}>
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isBusy}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-gradient text-sm font-extrabold text-white shadow-[0_12px_24px_-8px_rgba(0,96,103,0.4)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isBusy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
        {status === "submitting" ? "กำลังตรวจสอบ" : "ส่งสลิป"}
      </button>
    </form>
  );
}
