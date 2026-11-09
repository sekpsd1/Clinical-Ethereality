import { Download } from "lucide-react";
import { ReceiptImage } from "./ReceiptImage";

export function ReceiptDownload({ href, label = "ดาวน์โหลดใบเสร็จค่าปรึกษา (PDF)" }: { href?: string | null; label?: string }) {
  if (!href) return null;
  return (
    <div className="space-y-3">
      <ReceiptImage href={href} />
      <a href={href} download className="flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-3 text-center text-sm font-bold leading-5 text-primary shadow-payment-card ring-1 ring-primary/20">
        <Download aria-hidden="true" className="size-5 shrink-0" />
        {label}
      </a>
    </div>
  );
}
