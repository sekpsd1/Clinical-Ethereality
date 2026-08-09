import { CheckCircle2, CreditCard, ImageOff, QrCode, ReceiptText, ShieldCheck } from "lucide-react";
import { InfoTile } from "@/components/ui/InfoTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminPaymentReviewButtons } from "@/features/admin/AdminPaymentReviewButtons";
import { AdminPaymentRefundForm } from "@/features/admin/AdminPaymentRefundForm";
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

function getEvidenceTone(status: AdminPaymentQueueItem["status"]): "neutral" | "success" | "warning" | "danger" {
  if (status === "verified") {
    return "success";
  }

  if (status === "rejected") {
    return "danger";
  }

  return "warning";
}

export function AdminPayments({ data }: { data: AdminPaymentsData }) {
  const summaryItems = [
    {
      label: "รอสลิป",
      value: String(data.summary.pendingSlip),
      tone: "warning"
    },
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
        <p className="text-label font-bold uppercase text-white/75">ตรวจสลิป PromptPay</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">คิวตรวจสอบการชำระเงิน</h2>
        <p className="mt-2 max-w-[360px] text-sm leading-6 text-white/80">
          ตรวจสถานะสลิป หลักฐาน QR และผลจาก SlipOK/EasySlip สำหรับค่าปรึกษาและคำสั่งซื้อ
        </p>
      </section>

      <section className="grid grid-cols-4 gap-2">
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
          <StatusBadge tone={data.unavailable ? "danger" : "success"}>{data.unavailable ? "ฐานข้อมูลออฟไลน์" : "พร้อมใช้งาน"}</StatusBadge>
        </div>

        {data.unavailable ? (
          <EmptyPaymentQueue title="ยังไม่ได้เชื่อมต่อฐานข้อมูล" body="ตั้งค่าฐานข้อมูลและเตรียมโครงสร้างข้อมูลก่อนตรวจสอบสลิป" />
        ) : data.payments.length === 0 ? (
          <EmptyPaymentQueue title="ยังไม่มีรายการชำระเงิน" body="สลิปจากคำสั่งซื้อจะแสดงที่นี่เมื่อเข้าสู่คิวตรวจสอบ" />
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
                      <p className="mt-0.5 text-[10px] font-bold text-primary">{payment.paymentKindLabel}</p>
                    </div>
                    <StatusBadge tone={tone}>{statusLabels[payment.status]}</StatusBadge>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted">{payment.itemSummary}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <InfoTile label="ยอดชำระ" value={payment.amount} />
                <InfoTile label="ช่องทาง" value={payment.methodLabel} />
                <InfoTile label="LINE" value={payment.customerLineId} />
                <InfoTile label="ผลตรวจ" value={payment.resultLabel} />
              </div>

              <div className="mt-4 rounded-[8px] border border-dashed border-border bg-primary/5 p-3">
                <div className="flex items-start gap-2 text-xs font-semibold text-primary">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2.1} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={getEvidenceTone(payment.status)}>{payment.reviewSourceLabel}</StatusBadge>
                      <span className="text-muted">{payment.providerLabel}</span>
                    </div>
                    <p className="mt-2 break-words leading-5 text-[#3e494a]">{payment.evidenceSummary}</p>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-xs">
                <EvidenceRow icon="qr" label="ข้อมูล QR" value={payment.qrPayloadStatus} />
                <EvidenceRow icon="slip" label="ลิงก์สลิป" value={payment.slipImageUrl ?? "ยังไม่มี URL/ไฟล์สลิป"} href={payment.slipImageUrl} />
                {payment.transRef ? <EvidenceRow icon="check" label="เลขอ้างอิง" value={payment.transRef} /> : null}
                {payment.verifiedAmount ? <EvidenceRow icon="check" label="ยอดจากผู้ให้บริการ" value={payment.verifiedAmount} /> : null}
                {payment.receiverName ? <EvidenceRow icon="check" label="ชื่อผู้รับ" value={payment.receiverName} /> : null}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                <p className="min-w-0 truncate text-[11px] font-semibold text-muted">
                  ส่งเมื่อ {payment.submittedAt}
                  {payment.reviewedAt ? ` • ตรวจแล้ว ${payment.reviewedAt}` : ""}
                  {payment.reviewedByName ? ` • โดย ${payment.reviewedByName}` : ""}
                </p>
                {payment.status === "pending_review" && payment.canManualReview ? <AdminPaymentReviewButtons payment={payment} /> : null}
              </div>
              {payment.status === "verified" && payment.orderId ? <AdminPaymentRefundForm payment={payment} /> : null}
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

function EvidenceRow({
  icon,
  label,
  value,
  href
}: {
  icon: "check" | "qr" | "slip";
  label: string;
  value: string;
  href?: string | null;
}) {
  const Icon = icon === "check" ? CheckCircle2 : icon === "qr" ? QrCode : value.startsWith("ยังไม่มี") ? ImageOff : ReceiptText;
  const content = href ? (
    <a href={href} target="_blank" rel="noreferrer" className="truncate font-semibold text-primary underline-offset-2 hover:underline">
      {value}
    </a>
  ) : (
    <span className="truncate font-semibold text-[#3e494a]">{value}</span>
  );

  return (
    <div className="flex items-center gap-2 rounded-[8px] bg-white/70 px-3 py-2">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" strokeWidth={2.1} />
      <span className="shrink-0 text-[10px] font-bold uppercase text-muted">{label}</span>
      <span className="min-w-0 flex-1 text-right">{content}</span>
    </div>
  );
}
