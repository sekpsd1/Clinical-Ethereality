import { Download } from "lucide-react";

export function ReceiptDownload({ href }: { href?: string | null }) {
  if (!href) return null;
  // Native anchor: no Next prefetch, no consent/booking action and LINE can download.
  return (
    <a href={href} download className="flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-3 text-center text-sm font-bold leading-5 text-primary shadow-payment-card ring-1 ring-primary/20">
      <Download aria-hidden="true" className="size-5 shrink-0" />
      ดาวน์โหลดใบเสร็จค่าปรึกษา (PDF)
    </a>
  );
}
