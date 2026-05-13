import { CreditCard, ImageOff, ReceiptText } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminPaymentReviewButtons } from "@/features/admin/AdminPaymentReviewButtons";
import type { AdminPaymentQueueItem, AdminPaymentsData } from "@/features/admin/payments/types";

const statusLabels: Record<string, string> = {
  pending_slip: "รอสลิป",
  pending_review: "รอตรวจสอบ",
  verified: "ยืนยันแล้ว",
  rejected: "ปฏิเสธแล้ว",
  refunded: "คืนเงินแล้ว"
};

function getStatusTone(status: AdminPaymentQueueItem["status"]): "neutral" | "success" | "warning" | "danger" {
  if (status === "verified") {
    return "success";
  }

  if (status === "pending_review" || status === "pending_slip") {
    return "warning";
  }

  if (status === "rejected" || status === "refunded") {
    return "danger";
  }

  return "neutral";
}

export function AdminPayments({ data }: { data: AdminPaymentsData }) {
  const summaryItems = [
    {
      label: "รอตรวจสอบ",
      value: String(data.summary.pendingReview),
      tone: "warning"
    },
    {
      label: "ยืนยันแล้ว",
      value: String(data.summary.verified),
      tone: "success"
    },
    {
      label: "ปฏิเสธ",
      value: String(data.summary.rejected),
      tone: "danger"
    }
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking">
        <p className="text-label font-bold uppercase text-white/75">PromptPay Review</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">คิวตรวจสอบการชำระเงิน</h2>
        <p className="mt-2 max-w-[340px] text-sm leading-6 text-white/80">
          ตรวจสลิปพร้อมเพย์จากคำสั่งซื้อก่อนส่งต่อให้เภสัชกรจัดเตรียมยา
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {summaryItems.map((item) => (
          <div key={item.label} className="rounded-[8px] border border-border bg-white/85 p-3 shadow-payment-card">
            <p className="font-headline text-2xl font-bold text-text">{item.value}</p>
            <p className="mt-1 min-h-8 text-[10px] font-semibold leading-4 text-muted">{item.label}</p>
            <div className="mt-2">
              <StatusBadge tone={item.tone}>{item.label}</StatusBadge>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-bold text-text">รายการชำระเงิน</h2>
          <StatusBadge tone={data.unavailable ? "danger" : "success"}>
            {data.unavailable ? "ฐานข้อมูลออฟไลน์" : "พร้อมใช้งาน"}
          </StatusBadge>
        </div>

        {data.unavailable ? (
          <EmptyPaymentQueue title="ยังไม่ได้เชื่อมต่อฐานข้อมูล" body="ตั้งค่า DATABASE_URL และรัน Prisma schema ก่อนตรวจสอบสลิป" />
        ) : data.payments.length === 0 ? (
          <EmptyPaymentQueue title="ยังไม่มีรายการชำระเงิน" body="สลิปจากคำสั่งซื้อจะปรากฏที่นี่เมื่อเข้าสู่คิวตรวจสอบ" />
        ) : null}

        {data.payments.map((payment) => {
          const tone = getStatusTone(payment.status);

          return (
            <article key={payment.id} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
              <div className="flex gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <CreditCard aria-hidden="true" className="size-5" strokeWidth={2.1} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-text">{payment.orderCode}</h3>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-muted">{payment.customerName}</p>
                    </div>
                    <StatusBadge tone={tone}>{statusLabels[payment.status]}</StatusBadge>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted">{payment.itemSummary}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <InfoTile label="ยอดชำระ" value={payment.amount} />
                <InfoTile label="LINE" value={payment.customerLineId} />
              </div>

              <div className="mt-4 rounded-[8px] border border-dashed border-border bg-primary/5 p-3">
                {payment.slipImageUrl ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <ReceiptText aria-hidden="true" className="size-4" strokeWidth={2.1} />
                    <span className="truncate">{payment.slipImageUrl}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                    <ImageOff aria-hidden="true" className="size-4" strokeWidth={2.1} />
                    <span>ยังไม่มีไฟล์สลิป</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                <p className="min-w-0 truncate text-[11px] font-semibold text-muted">
                  ส่งเมื่อ {payment.submittedAt}
                  {payment.reviewedAt ? ` · ตรวจแล้ว ${payment.reviewedAt}` : ""}
                </p>
                {payment.status === "pending_review" ? <AdminPaymentReviewButtons payment={payment} /> : null}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function EmptyPaymentQueue({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center">
      <h3 className="text-sm font-bold text-text">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted">{body}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-primary/5 px-3 py-2">
      <p className="text-[10px] font-bold uppercase text-muted">{label}</p>
      <p className="mt-0.5 truncate font-bold text-primary">{value}</p>
    </div>
  );
}
