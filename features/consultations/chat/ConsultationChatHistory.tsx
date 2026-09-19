import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, LockKeyhole, MessageCircle } from "lucide-react";
import { consultationChatExportFilename } from "@/features/consultations/chat/history-queries";
import type {
  ConsultationChatHistoryData,
  ConsultationChatHistoryMessage
} from "@/features/consultations/chat/history-types";

const senderRoleLabels = {
  admin: "แอดมิน",
  customer: "ผู้รับบริการ",
  doctor: "แพทย์",
  pharmacist: "เภสัชกร"
} as const;

function formatMessageDateTime(value: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function HistoryMessage({ message }: { message: ConsultationChatHistoryMessage }) {
  return (
    <li className={`flex ${message.isOwnMessage ? "justify-end" : "justify-start"}`}>
      <article
        className={
          message.isOwnMessage
            ? "max-w-[88%] rounded-[20px] rounded-br-md bg-primary px-4 py-3 text-white shadow-payment-card"
            : "max-w-[88%] rounded-[20px] rounded-bl-md border border-border bg-white/90 px-4 py-3 text-text shadow-payment-card"
        }
      >
        <p className={`text-[11px] font-bold ${message.isOwnMessage ? "text-white/80" : "text-primary"}`}>
          {message.senderName} • {senderRoleLabels[message.senderRole]}
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
        <time
          dateTime={message.createdAt}
          className={`mt-1 block text-[10px] font-semibold ${message.isOwnMessage ? "text-white/70" : "text-muted"}`}
        >
          {formatMessageDateTime(message.createdAt)}
        </time>
      </article>
    </li>
  );
}

export function ConsultationChatHistory({
  data,
  backHref,
  pageHref
}: {
  data: ConsultationChatHistoryData;
  backHref: Route;
  pageHref: string;
}) {
  const previousHref = `${pageHref}?page=${data.page - 1}` as Route;
  const nextHref = `${pageHref}?page=${data.page + 1}` as Route;
  const downloadHref = `/api/consultations/${encodeURIComponent(data.consultationId)}/chat-history/download`;

  return (
    <section className="-mx-4 min-h-dvh bg-app pb-8">
      <header className="sticky top-0 z-header border-b border-border/70 bg-white/90 px-4 py-3 backdrop-blur-topbar">
        <div className="mx-auto flex max-w-mobile items-center gap-3">
          <Link
            href={backHref}
            aria-label="กลับ"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary/5"
          >
            <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.2} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold leading-6 text-primary">ประวัติแชต</h1>
            <p className="truncate text-xs font-semibold text-muted">การปรึกษากับ {data.counterpartName}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-mobile flex-col gap-4 px-4 pt-4">
        <aside className="rounded-[16px] border border-primary/15 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <LockKeyhole aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={2.1} />
            <div>
              <h2 className="text-sm font-bold text-text">อ่านอย่างเดียวหลังจบการปรึกษา</h2>
              <p className="mt-1 text-xs leading-5 text-muted">
                แสดงเฉพาะแชตในแอป Clinical lab service เท่านั้น ไม่รวม Zoom Chat
              </p>
              <a
                href={downloadHref}
                download={consultationChatExportFilename}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-white shadow-payment-active sm:w-auto"
              >
                <Download aria-hidden="true" className="size-4" strokeWidth={2.1} />
                ดาวน์โหลดแชต
              </a>
            </div>
          </div>
        </aside>

        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-xs font-bold text-text">ข้อความทั้งหมด {data.totalMessages} รายการ</p>
          <p className="text-[11px] font-semibold text-muted">หน้า {data.page} จาก {data.totalPages}</p>
        </div>

        {data.messages.length > 0 ? (
          <ol aria-label="ข้อความตามลำดับเวลา" className="flex flex-col gap-3">
            {data.messages.map((message) => (
              <HistoryMessage key={message.id} message={message} />
            ))}
          </ol>
        ) : (
          <div className="rounded-[20px] border border-dashed border-border bg-white/70 p-8 text-center">
            <MessageCircle aria-hidden="true" className="mx-auto size-8 text-primary/60" strokeWidth={1.8} />
            <h2 className="mt-3 text-sm font-bold text-text">ไม่มีข้อความในการปรึกษานี้</h2>
            <p className="mt-1 text-xs leading-5 text-muted">หน้านี้ไม่มีช่องส่ง แก้ไข หรือลบข้อความ</p>
          </div>
        )}

        {data.totalPages > 1 ? (
          <nav aria-label="หน้าประวัติแชต" className="grid grid-cols-2 gap-3 border-t border-border/70 pt-4">
            {data.page > 1 ? (
              <Link
                href={previousHref}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white text-xs font-bold text-primary ring-1 ring-primary/25"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
                ก่อนหน้า
              </Link>
            ) : (
              <span className="inline-flex min-h-11 items-center justify-center rounded-full bg-surface text-xs font-bold text-muted ring-1 ring-border">
                ก่อนหน้า
              </span>
            )}
            {data.page < data.totalPages ? (
              <Link
                href={nextHref}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary text-xs font-bold text-white shadow-payment-active"
              >
                ถัดไป
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            ) : (
              <span className="inline-flex min-h-11 items-center justify-center rounded-full bg-surface text-xs font-bold text-muted ring-1 ring-border">
                ถัดไป
              </span>
            )}
          </nav>
        ) : null}
      </div>
    </section>
  );
}
