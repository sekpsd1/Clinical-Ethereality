"use client";

import { useState } from "react";
import { TELEMEDICINE_CONSENT_VERSION } from "./policy";
import { TelemedicineConsentDialog } from "./TelemedicineConsentDialog";

export function BookingTelemedicineConsent({ accepted, onChange }: { accepted: boolean; onChange: (accepted: boolean) => void }) {
  const [open, setOpen] = useState(false);
  function openDocument() {
    onChange(false);
    setOpen(true);
  }
  return (
    <section className="space-y-3 rounded-[20px] border border-primary/25 bg-white/80 p-4 shadow-sm" aria-label="ความยินยอมสำหรับการจอง">
      <button type="button" onClick={openDocument} aria-haspopup="dialog" className="min-h-12 w-full rounded-full border border-primary/30 px-4 text-sm font-bold text-primary underline underline-offset-4">อ่านความยินยอม</button>
      <label className="flex gap-3 text-sm leading-6 text-[#3e494a]">
        <input type="checkbox" name="telemedicineConsentAccepted" required checked={accepted} onChange={(event) => { if (event.target.checked) openDocument(); else onChange(false); }} className="mt-1 size-5 shrink-0 accent-primary" />
        <span>ยินยอมรับบริการ Telemedicine สำหรับการจองนี้ ฉบับ {TELEMEDICINE_CONSENT_VERSION} {accepted ? "(ยินยอมแล้ว ยกเลิกได้โดยนำเครื่องหมายออก)" : "(เปิดเอกสารเพื่ออ่านและเลือกยินยอม)"}</span>
      </label>
      {open ? <TelemedicineConsentDialog onAccept={() => { onChange(true); setOpen(false); }} onDismiss={() => { onChange(false); setOpen(false); }} /> : null}
    </section>
  );
}
