import { DatabaseZap, FileClock, ReceiptText, ScrollText } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AdminAuditLogData, AdminAuditLogItem } from "@/features/admin/audit/types";

export function AdminAuditLog({ data }: { data: AdminAuditLogData }) {
  return (
    <div className="space-y-5">
      <section className="rounded-[8px] bg-primary-gradient p-5 text-white shadow-card">
        <p className="text-label font-bold uppercase text-white/75">บันทึกการตรวจสอบ</p>
        <h2 className="mt-2 font-headline text-2xl font-bold">ประวัติการดำเนินการสำคัญ</h2>
        <p className="mt-2 text-sm leading-6 text-white/80">
          การชำระเงิน ใบสั่งยา การจัดส่ง สต็อก การดูแลชุมชน แต้มสะสม และบัญชีเจ้าหน้าที่ จะถูกบันทึกไว้เพื่อตรวจสอบย้อนหลัง
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <SummaryTile icon="total" label="รายการทั้งหมด" value={data.summary.total} />
        <SummaryTile icon="payment" label="การชำระเงิน" value={data.summary.payment} />
        <SummaryTile icon="prescription" label="ใบสั่งยา" value={data.summary.prescription} />
        <SummaryTile icon="operations" label="งานปฏิบัติการ" value={data.summary.operations} />
      </section>

      {data.unavailable ? (
        <section className="rounded-[8px] border border-border bg-white/85 p-4 text-sm text-muted shadow-payment-card">
          ไม่สามารถโหลดบันทึกการตรวจสอบได้ กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล
        </section>
      ) : null}

      {!data.unavailable && data.logs.length === 0 ? (
        <section className="rounded-[8px] border border-border bg-white/85 p-4 text-sm text-muted shadow-payment-card">
          ยังไม่มีบันทึกการดำเนินการสำคัญ
        </section>
      ) : null}

      <section className="space-y-3">
        {data.logs.map((log) => (
          <AuditLogCard key={log.id} log={log} />
        ))}
      </section>
    </div>
  );
}

function SummaryTile({ icon, label, value }: { icon: "total" | "payment" | "prescription" | "operations"; label: string; value: number }) {
  const Icon = icon === "payment" ? ReceiptText : icon === "prescription" ? FileClock : icon === "operations" ? DatabaseZap : ScrollText;

  return (
    <div className="rounded-[8px] border border-border bg-white/85 p-3 shadow-payment-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-label font-bold uppercase text-muted">{label}</p>
        <Icon aria-hidden="true" className="size-4 text-primary" />
      </div>
      <p className="mt-2 text-2xl font-bold text-text">{value}</p>
    </div>
  );
}

function AuditLogCard({ log }: { log: AdminAuditLogItem }) {
  return (
    <article className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-text">{log.action}</p>
          <p className="mt-1 truncate text-xs font-semibold text-muted">
            {log.entityType} / {log.entityId}
          </p>
        </div>
        <StatusBadge tone="neutral">{log.actorRole}</StatusBadge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <InfoTile label="ผู้ดำเนินการ" value={log.actor} />
        <InfoTile label="เวลาบันทึก" value={log.createdAt} />
      </dl>

      <pre className="mt-4 max-h-44 overflow-auto rounded-[8px] bg-slate-50 p-3 text-[11px] leading-5 text-slate-600">
        {log.metadata}
      </pre>
    </article>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-primary/5 p-3">
      <dt className="font-bold uppercase tracking-[0.08em] text-muted">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-text">{value}</dd>
    </div>
  );
}
