"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function AdminLineIdCopy({ lineId }: { lineId: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function copyLineId() {
    try {
      await navigator.clipboard.writeText(lineId);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted" title={lineId}>
        {lineId}
      </span>
      <button
        type="button"
        onClick={copyLineId}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-[10px] font-bold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label="คัดลอก LINE ID"
      >
        {copyState === "copied" ? (
          <Check aria-hidden="true" className="size-3" strokeWidth={2.2} />
        ) : (
          <Copy aria-hidden="true" className="size-3" strokeWidth={2.2} />
        )}
        {copyState === "copied" ? "คัดลอกแล้ว" : "คัดลอก"}
      </button>
      <span className="sr-only" aria-live="polite">
        {copyState === "failed" ? "คัดลอก LINE ID ไม่สำเร็จ" : copyState === "copied" ? "คัดลอก LINE ID แล้ว" : ""}
      </span>
    </div>
  );
}
