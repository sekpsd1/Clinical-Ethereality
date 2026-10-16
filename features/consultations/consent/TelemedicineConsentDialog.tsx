"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { TelemedicineConsentContent } from "./TelemedicineConsentContent";

export function TelemedicineConsentDialog({ onAccept, onDismiss }: { onAccept: () => void; onDismiss: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const titleId = useId();
  const instructionsId = useId();

  function checkEnd() {
    const body = scrollRef.current;
    if (body && body.clientHeight > 0 && body.scrollTop + body.clientHeight >= body.scrollHeight - 2) setReachedEnd(true);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    const body = scrollRef.current;
    if (!dialog || !body) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    body.focus();
    checkEnd();
    const observer = new ResizeObserver(checkEnd);
    observer.observe(body);
    if (body.firstElementChild) observer.observe(body.firstElementChild);
    return () => {
      observer.disconnect();
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={instructionsId}
      aria-modal="true"
      onCancel={(event) => { event.preventDefault(); onDismiss(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter((element) => element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      className="fixed inset-0 m-auto h-[calc(100dvh_-_2rem)] max-h-[48rem] w-[calc(100%_-_2rem)] max-w-mobile overflow-hidden rounded-[24px] border border-white/50 bg-white/95 p-0 text-[#3e494a] shadow-glass backdrop:bg-[#142326]/30 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-primary/20 px-4 py-3">
          <h2 id={titleId} className="min-w-0 text-base font-extrabold text-primary">ความยินยอม Telemedicine</h2>
          <button type="button" onClick={onDismiss} aria-label="ปิดความยินยอม" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f7f9fb] focus-visible:outline-primary">
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>
        <div ref={scrollRef} role="region" aria-label="เอกสารความยินยอม Telemedicine" tabIndex={0} onScroll={checkEnd} className="min-h-0 flex-1 overflow-y-auto overscroll-contain break-words px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
          <TelemedicineConsentContent />
        </div>
        <footer className="shrink-0 space-y-3 border-t border-primary/20 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p id={instructionsId} role="status" className="text-xs leading-5 text-[#616363]">
            {reachedEnd ? "เลื่อนถึงท้ายเอกสารแล้ว กรุณาเลือกยินยอมหรือไม่ยินยอม" : "เลื่อนเอกสารจนถึงท้ายก่อนกด “ยินยอม”"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onDismiss} className="min-h-12 rounded-full border border-primary/30 px-3 text-sm font-bold text-primary">ไม่ยินยอม</button>
            <button type="button" disabled={!reachedEnd} onClick={() => { if (reachedEnd) onAccept(); }} className="min-h-12 rounded-full bg-primary px-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">ยินยอม</button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
