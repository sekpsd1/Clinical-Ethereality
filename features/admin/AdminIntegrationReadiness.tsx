import { Settings2 } from "lucide-react";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { IntegrationReadinessData } from "@/features/admin/integrations/readiness";

export function AdminIntegrationReadiness({ data }: { data: IntegrationReadinessData }) {
  return (
    <section className="flex flex-col gap-3">
      <GlassSurface className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-label font-bold uppercase text-primary">ตั้งค่าโดยเจ้าของระบบ</p>
            <h2 className="mt-1 font-headline text-lg font-bold text-text">ความพร้อมของระบบเชื่อมต่อ</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              ตรวจจากค่าตั้งค่าระบบ โดยแสดงเฉพาะสถานะ ไม่แสดงค่า secret จริง
            </p>
          </div>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
            <Settings2 aria-hidden="true" className="size-5" strokeWidth={2.1} />
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <SummaryTile label="พร้อม" value={data.summary.ready} tone="success" />
          <SummaryTile label="ยังไม่ครบ" value={data.summary.partial} tone="warning" />
          <SummaryTile label="ยังไม่ตั้งค่า" value={data.summary.missing} tone="danger" />
        </div>
      </GlassSurface>

      <div className="grid gap-3">
        {data.items.map((item) => (
          <article key={item.label} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
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
        ))}
      </div>
    </section>
  );
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
