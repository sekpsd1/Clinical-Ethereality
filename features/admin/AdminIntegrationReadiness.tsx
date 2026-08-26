import { Settings2 } from "lucide-react";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { IntegrationReadinessData, IntegrationReadinessItem } from "@/features/admin/integrations/readiness";
import type {
  SmsOtpSchemaReadiness,
  SmsOtpSchemaReadinessStatus
} from "@/features/admin/integrations/sms-otp-schema-readiness";

export function AdminIntegrationReadiness({ data }: { data: IntegrationReadinessData }) {
  return (
    <section className="flex flex-col gap-3">
      <GlassSurface className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-label font-bold uppercase text-primary">ตั้งค่าโดยเจ้าของระบบ</p>
            <h2 className="mt-1 font-headline text-lg font-bold text-text">ความพร้อมของระบบเชื่อมต่อ</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              ตรวจ environment และ database schema แยกกัน โดยแสดงเฉพาะสถานะและชื่อส่วนประกอบที่ปลอดภัย
            </p>
          </div>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
            <Settings2 aria-hidden="true" className="size-5" strokeWidth={2.1} />
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryTile label="พร้อม" value={data.summary.ready} tone="success" />
          <SummaryTile label="ยังไม่ครบ" value={data.summary.partial} tone="warning" />
          <SummaryTile label="ยังไม่ตั้งค่า" value={data.summary.missing} tone="danger" />
          <SummaryTile label="ตรวจไม่ได้" value={data.summary.unavailable} tone="danger" />
        </div>
      </GlassSurface>

      <div className="grid gap-3">
        {data.items.map((item, index) => (
          <div key={item.label} className="grid gap-3">
            <IntegrationReadinessCard item={item} />
            {index === 0 ? <SmsOtpSchemaReadinessCard readiness={data.smsOtpSchema} /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function IntegrationReadinessCard({ item }: { item: IntegrationReadinessItem }) {
  return (
    <article className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-text">{item.label}</h3>
          <p className="mt-1 text-xs leading-5 text-muted">{item.detail}</p>
        </div>
        <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
      </div>

      <div className="mt-3 grid gap-2 text-xs leading-5">
        {item.configured.length > 0 ? (
          <p className="text-success">
            ตั้งค่าแล้ว: <span className="font-semibold">{item.configured.join(", ")}</span>
          </p>
        ) : null}
        {item.missing.length > 0 ? (
          <p className="text-muted">
            ยังขาด: <span className="font-semibold">{item.missing.join(", ")}</span>
          </p>
        ) : null}
      </div>
    </article>
  );
}

function SmsOtpSchemaReadinessCard({ readiness }: { readiness: SmsOtpSchemaReadiness }) {
  const componentGroups = {
    ready: readiness.components.filter((component) => component.status === "ready"),
    not_ready: readiness.components.filter((component) => component.status === "not_ready"),
    unavailable: readiness.components.filter((component) => component.status === "unavailable")
  };

  return (
    <article className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-text">SMS OTP — Database schema</h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            ตรวจ migration, columns, table, indexes และ foreign key แบบ read-only ภายใน Admin runtime
          </p>
        </div>
        <StatusBadge tone={schemaTone(readiness.status)}>{readiness.status}</StatusBadge>
      </div>

      <div className="mt-3 grid gap-2 text-xs leading-5">
        {(Object.keys(componentGroups) as SmsOtpSchemaReadinessStatus[]).map((status) => {
          const components = componentGroups[status];
          return components.length > 0 ? (
            <p key={status} className={status === "ready" ? "text-success" : "text-muted"}>
              {status}: <span className="font-semibold">{components.map((component) => component.name).join(", ")}</span>
            </p>
          ) : null;
        })}
      </div>
    </article>
  );
}

function schemaTone(status: SmsOtpSchemaReadinessStatus): "success" | "warning" | "danger" {
  return status === "ready" ? "success" : status === "not_ready" ? "warning" : "danger";
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "danger" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-danger";

  return (
    <div className="rounded-[8px] border border-border bg-white/70 p-3 text-center">
      <p className={`font-headline text-2xl font-bold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[10px] font-semibold leading-4 text-muted">{label}</p>
    </div>
  );
}
