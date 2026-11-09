import { Download } from "lucide-react";

export function ReceiptImage({ href }: { href?: string | null }) {
  if (!href) return null;
  const imageUrl = `${href}?format=jpg`;
  const downloadUrl = `${imageUrl}&download=1&handoff=1`;

  return (
    <div className="space-y-3">
      <details className="rounded-xl bg-primary/5 p-4 text-sm">
        <summary className="cursor-pointer font-bold text-primary">ดูใบเสร็จแบบรูปภาพ (JPG)</summary>
        <a href={downloadUrl} aria-label="แตะรูปเพื่อดาวน์โหลดใบเสร็จ JPG" className="mt-3 block">
          {/* Load directly so the image request uses the viewer's session. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="ใบเสร็จรับเงิน" loading="lazy" className="h-auto w-full rounded-lg" />
        </a>
      </details>
      <a
        href={downloadUrl}
        className="flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-3 text-center text-sm font-bold text-primary ring-1 ring-primary/20"
      >
        <Download aria-hidden="true" className="size-5 shrink-0" />
        ดาวน์โหลดใบเสร็จ JPG
      </a>
    </div>
  );
}
