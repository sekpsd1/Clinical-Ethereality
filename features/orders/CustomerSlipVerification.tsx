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
    setMessage("Reading the slip QR from this image.");

    const BarcodeDetector = getBarcodeDetector();

    if (!BarcodeDetector) {
      setStatus("idle");
      setMessage("This browser cannot read slip QR codes automatically. Paste the QR payload or hosted slip URL below.");
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
        setMessage("No QR code was found in this slip. Try a clearer image or paste the payload manually.");
        return;
      }

      setQrPayload(nextPayload);
      setStatus("idle");
      setMessage("Slip QR detected. Submit to verify this payment.");
    } catch {
      setStatus("idle");
      setMessage("The slip image could not be read. Try a clearer image or paste the payload manually.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedPayload = qrPayload.trim();
    const trimmedImageUrl = imageUrl.trim();

    if (!trimmedPayload && !trimmedImageUrl) {
      setStatus("error");
      setMessage("Upload a readable slip, paste the slip QR payload, or provide a hosted slip image URL.");
      return;
    }

    setStatus("submitting");
    setMessage("Verifying this slip with the configured provider.");

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
        throw new Error(payload?.error ?? "Slip verification failed.");
      }

      if (!payload?.ok) {
        setStatus("error");
        setMessage("The provider rejected this slip. Check the transfer amount, receiver, and slip image.");
        router.refresh();
        return;
      }

      setStatus("success");
      setMessage("Payment verified. Pharmacy preparation can begin.");
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Slip verification provider is unavailable.");
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
          <p className="text-sm font-extrabold text-primary">Verify PromptPay slip</p>
          <p className="mt-1 text-xs leading-5 text-[#3e494a]">{orderCode} is waiting for slip verification.</p>
        </div>
      </div>

      <label className="mt-4 flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-[18px] bg-teal-50/70 px-4 py-5 text-center text-primary ring-1 ring-teal-100">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="mb-3 max-h-28 rounded-[14px] object-contain" />
        ) : (
          <CloudUpload aria-hidden="true" className="mb-3 size-8" />
        )}
        <span className="text-sm font-bold">{fileName ?? "Upload transfer slip"}</span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#3e494a]">
          QR is read locally before provider verification
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
            placeholder="Detected automatically when the slip image contains a readable QR code"
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
        {status === "submitting" ? "Verifying" : "Submit slip"}
      </button>
    </form>
  );
}
