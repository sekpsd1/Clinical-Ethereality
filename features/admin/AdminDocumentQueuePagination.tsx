import Link from "next/link";
import type { DocumentQueuePagination } from "@/features/admin/document-queue-pagination";

const linkStyle = "inline-flex min-h-9 items-center rounded-full px-3 font-bold text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

export function AdminDocumentQueuePagination({ path, label, pagination }: {
  path: "/admin/orders" | "/admin/payments";
  label: string;
  pagination: DocumentQueuePagination;
}) {
  const { page, totalPages } = pagination;
  if (totalPages <= 1) return null;

  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-border bg-white/85 p-3 text-xs shadow-payment-card">
      {page > 1 ? <Link className={linkStyle} prefetch={false} href={`${path}?page=${page - 1}`}>ก่อนหน้า</Link> : null}
      <p className="font-semibold text-muted">หน้า {page} จาก {totalPages}</p>
      {page < totalPages ? <Link className={linkStyle} prefetch={false} href={`${path}?page=${page + 1}`}>ถัดไป</Link> : null}
    </nav>
  );
}
