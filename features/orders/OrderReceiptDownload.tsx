"use client";

import { useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { loadLiffSdk } from "@/features/auth/liff-sdk";

const buttonClass = "flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-3 text-center text-sm font-bold text-primary ring-1 ring-primary/20 disabled:opacity-60";

export function OrderReceiptDownload({ orderId, inLine, liffId }: {
  orderId: string;
  inLine: boolean;
  liffId?: string;
}) {
  const [opening, setOpening] = useState(false);
  const [browserUrl, setBrowserUrl] = useState("");

  async function openInBrowser() {
    const url = new URL(`/store/orders/${encodeURIComponent(orderId)}`, window.location.origin);
    setBrowserUrl(url.href);
    setOpening(true);
    try {
      if (!liffId) throw new Error("LINE LIFF is unavailable");
      const liff = await loadLiffSdk();
      await liff.init({ liffId });
      liff.openWindow({ url: url.href, external: true });
    } catch {
      // The selectable link remains available if LINE cannot launch a browser.
    } finally {
      setOpening(false);
    }
  }

  if (!inLine) {
    return (
      <a href={`/api/orders/${encodeURIComponent(orderId)}/receipt`} download className={buttonClass}>
        <Download aria-hidden="true" className="size-5 shrink-0" />
        ดาวน์โหลดใบเสร็จ (PDF)
      </a>
    );
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => void openInBrowser()} disabled={opening} className={buttonClass}>
        <ExternalLink aria-hidden="true" className="size-5 shrink-0" />
        {opening ? "กำลังเปิดเบราว์เซอร์…" : "เปิดเบราว์เซอร์เพื่อดาวน์โหลด PDF"}
      </button>
      <p className="text-sm text-[#3e494a]">
        หากระบบขอให้เข้าสู่ระบบ ให้ใช้บัญชี LINE เดิม แล้วกดดาวน์โหลดในเบราว์เซอร์
      </p>
      {browserUrl ? (
        <label className="block text-sm text-[#3e494a]">
          หากเบราว์เซอร์ไม่เปิด ให้คัดลอกลิงก์นี้ไปเปิดใน Chrome หรือ Safari
          <input
            readOnly value={browserUrl} onFocus={event => event.currentTarget.select()}
            className="mt-2 w-full rounded-lg border border-primary/20 bg-white px-3 py-2"
          />
        </label>
      ) : null}
    </div>
  );
}
