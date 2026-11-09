"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { Download, ExternalLink } from "lucide-react";
import { loadLiffSdk } from "@/features/auth/liff-sdk";

const buttonClass = "flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-3 text-center text-sm font-bold text-primary ring-1 ring-primary/20";

export function OrderReceiptDownload({ orderId, browserUrl, liffId }: {
  orderId: string;
  browserUrl?: string;
  liffId?: string;
}) {
  const [liffReady, setLiffReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!browserUrl || !liffId) return;
    let active = true;
    void loadLiffSdk().then(async liff => {
      if (!liff.isInClient()) return;
      await liff.init({ liffId });
      if (active) setLiffReady(true);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [browserUrl, liffId]);

  if (!browserUrl) {
    return (
      <a href={`/api/orders/${encodeURIComponent(orderId)}/receipt`} download className={buttonClass}>
        <Download aria-hidden="true" className="size-5 shrink-0" />
        ดาวน์โหลดใบเสร็จ (PDF)
      </a>
    );
  }

  const orderUrl = browserUrl;
  const externalUrl = new URL(orderUrl);
  externalUrl.searchParams.set("openExternalBrowser", "1");

  function openInBrowser(event: MouseEvent<HTMLAnchorElement>) {
    if (!liffReady || !window.liff) return;
    try {
      window.liff.openWindow({ url: orderUrl, external: true });
      event.preventDefault();
    } catch {
      // Keep the link's normal navigation if the LIFF bridge throws.
    }
  }

  async function copyOrderUrl() {
    try {
      await navigator.clipboard.writeText(orderUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      <a href={externalUrl.href} onClick={openInBrowser} className={buttonClass}>
        <ExternalLink aria-hidden="true" className="size-5 shrink-0" />
        เปิดเบราว์เซอร์เพื่อดาวน์โหลด PDF
      </a>
      <p className="text-sm text-[#3e494a]">
        หากยังอยู่ใน LINE ให้คัดลอกลิงก์ไปเปิดใน Chrome หรือ Safari เข้าสู่ระบบด้วยบัญชี LINE เดิม แล้วกดดาวน์โหลด
      </p>
      <button type="button" onClick={() => void copyOrderUrl()} className={buttonClass}>
        {copied ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์คำสั่งซื้อ"}
      </button>
      <input
        aria-label="ลิงก์คำสั่งซื้อ"
        readOnly value={orderUrl} onFocus={event => event.currentTarget.select()}
        className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm"
      />
    </div>
  );
}
