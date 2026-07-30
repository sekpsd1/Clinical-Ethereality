"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

export function ShareButton({
  href,
  label = "Share post",
  className = "text-slate-400"
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  const [status, setStatus] = useState("");

  async function share() {
    const url = new URL(href, window.location.origin).toString();

    try {
      if (navigator.share) {
        await navigator.share({
          title: document.title,
          url
        });
        setStatus("แชร์แล้ว");
      } else {
        await navigator.clipboard.writeText(url);
        setStatus("คัดลอกลิงก์แล้ว");
      }
    } catch {
      setStatus("ยังแชร์ไม่ได้");
    }
  }

  return (
    <span className="relative inline-flex">
      <button type="button" aria-label={label} onClick={share} className={className}>
        <Share2 aria-hidden="true" className="size-5" />
      </button>
      <span className="sr-only" role="status">
        {status}
      </span>
    </span>
  );
}
