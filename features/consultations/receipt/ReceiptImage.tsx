export function ReceiptImage({ href }: { href: string }) {
  return (
    <details className="rounded-xl bg-primary/5 p-4 text-sm">
      <summary className="cursor-pointer font-bold text-primary">ดูใบเสร็จแบบรูปภาพ (JPG)</summary>
      <p className="my-3 text-[#3e494a]">แตะค้างที่รูปเพื่อบันทึก หาก LINE แสดงเมนูบันทึกรูป</p>
      {/* The authenticated image URL must load directly with the viewer's session. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${href}?format=jpg`} alt="ใบเสร็จรับเงิน" loading="lazy" className="h-auto w-full rounded-lg" />
    </details>
  );
}
