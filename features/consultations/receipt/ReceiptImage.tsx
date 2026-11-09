export function ReceiptImage({ href }: { href?: string | null }) {
  if (!href) return null;
  const imageUrl = `${href}?format=jpg`;

  return (
    <details className="rounded-xl bg-primary/5 p-4 text-sm">
      <summary className="cursor-pointer font-bold text-primary">ดูใบเสร็จแบบรูปภาพ (JPG)</summary>
      <p className="my-3 text-[#3e494a]">แตะรูปเพื่อดาวน์โหลด JPG หรือแตะค้างเพื่อบันทึกรูปจากเมนู LINE</p>
      <a href={`${imageUrl}&download=1`} download aria-label="ดาวน์โหลดใบเสร็จ JPG" className="block">
        {/* Load directly so the image request uses the viewer's session. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="ใบเสร็จรับเงิน" loading="lazy" className="h-auto w-full rounded-lg" />
      </a>
    </details>
  );
}
