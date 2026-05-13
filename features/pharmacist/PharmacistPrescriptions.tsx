import { ClipboardCheck, FileText, Stethoscope } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PharmacistPrescriptionActions } from "@/features/pharmacist/PharmacistPrescriptionActions";
import type {
  PharmacistPrescriptionItem,
  PharmacistPrescriptionsData
} from "@/features/pharmacist/prescriptions/types";

const statusLabels: Record<string, string> = {
  archived: "เก็บถาวร",
  dispensed: "จ่ายยาแล้ว",
  draft: "ฉบับร่าง",
  pending_verification: "รอตรวจ",
  rejected: "ปฏิเสธ",
  verified: "ยืนยันแล้ว"
};

function getStatusTone(status: PharmacistPrescriptionItem["status"]): "neutral" | "success" | "warning" | "danger" {
  if (status === "verified" || status === "dispensed") {
    return "success";
  }

  if (status === "pending_verification" || status === "draft") {
    return "warning";
  }

  if (status === "rejected" || status === "archived") {
    return "danger";
  }

  return "neutral";
}

export function PharmacistPrescriptions({ data }: { data: PharmacistPrescriptionsData }) {
  const summaryItems = [
    {
      label: "รอตรวจ",
      value: String(data.summary.pendingVerification),
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
        <p className="text-label font-bold uppercase text-white/75">Prescription Queue</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">คิวตรวจใบสั่งยา</h2>
        <p className="mt-2 max-w-[340px] text-sm leading-6 text-white/80">
          ตรวจใบสั่งยาจากแพทย์ก่อนส่งต่อคำสั่งซื้อเข้าสู่การจัดเตรียมยา
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
          <h2 className="font-headline text-lg font-bold text-text">รายการใบสั่งยา</h2>
          <StatusBadge tone={data.unavailable ? "danger" : "success"}>
            {data.unavailable ? "ฐานข้อมูลออฟไลน์" : "พร้อมใช้งาน"}
          </StatusBadge>
        </div>

        {data.unavailable ? (
          <EmptyPrescriptionQueue
            title="ยังไม่ได้เชื่อมต่อฐานข้อมูล"
            body="ตั้งค่า DATABASE_URL และรัน Prisma schema ก่อนตรวจใบสั่งยา"
          />
        ) : data.prescriptions.length === 0 ? (
          <EmptyPrescriptionQueue title="ยังไม่มีใบสั่งยา" body="ใบสั่งยาที่แพทย์สร้างจะปรากฏที่นี่เมื่อมีข้อมูลในระบบ" />
        ) : null}

        {data.prescriptions.map((prescription) => {
          const tone = getStatusTone(prescription.status);

          return (
            <article key={prescription.id} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
              <div className="flex gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <ClipboardCheck aria-hidden="true" className="size-5" strokeWidth={2.1} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-text">{prescription.patientName}</h3>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-muted">{prescription.doctorName}</p>
                    </div>
                    <StatusBadge tone={tone}>{statusLabels[prescription.status]}</StatusBadge>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted">{prescription.productSummary}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <InfoTile label="สร้างเมื่อ" value={prescription.createdAt} icon="file" />
                <InfoTile label="ตรวจเมื่อ" value={prescription.verifiedAt ?? "ยังไม่ตรวจ"} icon="doctor" />
              </div>

              {prescription.notes || prescription.consultationSummary ? (
                <div className="mt-4 rounded-[8px] bg-primary/5 p-3">
                  <p className="line-clamp-3 text-xs leading-5 text-muted">
                    {prescription.notes ?? prescription.consultationSummary}
                  </p>
                </div>
              ) : null}

              {prescription.status === "pending_verification" ? (
                <div className="mt-4 flex justify-end border-t border-border/70 pt-3">
                  <PharmacistPrescriptionActions prescription={prescription} />
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}

function EmptyPrescriptionQueue({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center">
      <h3 className="text-sm font-bold text-text">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted">{body}</p>
    </div>
  );
}

function InfoTile({ label, value, icon }: { label: string; value: string; icon: "doctor" | "file" }) {
  const Icon = icon === "doctor" ? Stethoscope : FileText;

  return (
    <div className="rounded-[8px] bg-primary/5 px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted">
        <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
        <p className="text-[10px] font-bold uppercase">{label}</p>
      </div>
      <p className="mt-0.5 truncate font-bold text-primary">{value}</p>
    </div>
  );
}
