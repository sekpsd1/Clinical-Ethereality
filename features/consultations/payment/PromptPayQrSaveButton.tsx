"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export function PromptPayQrSaveButton({ qrDataUrl }: { qrDataUrl: string }) {
  const [saveHint, setSaveHint] = useState<string | null>(null);

  const handleSave = () => {
    const base64 = qrDataUrl.slice("data:image/png;base64,".length);
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const file = new File([bytes], "promptpay-qr.png", { type: "image/png" });
    const canShareFiles =
      typeof navigator.share === "function" &&
      (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] }));

    if (!canShareFiles) {
      setSaveHint("อุปกรณ์นี้ไม่รองรับการบันทึกจาก LINE โดยตรง ให้เปิด QR เป็นรูปภาพแล้วกดบันทึกรูป");
      return;
    }

    void navigator
      .share({ files: [file], title: "PromptPay QR Code" })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSaveHint("ยังเปิดเมนูบันทึกไม่ได้ ให้เปิด QR เป็นรูปภาพแล้วกดบันทึกรูป");
      });
  };

  return (
    <div className="mb-4 flex w-full flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleSave}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-5 text-sm font-bold text-primary transition-colors hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <Download aria-hidden="true" className="size-4" strokeWidth={2.25} />
        บันทึก/แชร์ QR Code
      </button>
      {saveHint ? (
        <p role="status" className="text-center text-xs leading-5 text-[#3e494a]">
          {saveHint}{" "}
          <a href={qrDataUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline">
            เปิด QR เป็นรูปภาพ
          </a>
        </p>
      ) : null}
    </div>
  );
}
