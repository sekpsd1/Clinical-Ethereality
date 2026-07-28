import {
  ArrowUpRight,
  CalendarClock,
  ClipboardCheck,
  Clock3,
  ShieldCheck,
  Stethoscope,
  UserRound
} from "lucide-react";
import Link from "next/link";
import { InfoTile } from "@/components/ui/InfoTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AdminCustomerListItem, AdminCustomersData } from "@/features/admin/customers/types";

const accountStatusLabels = {
  active: "ใช้งานอยู่",
  archived: "เก็บถาวร",
  pending_review: "รอตรวจสอบ",
  suspended: "ระงับใช้งาน"
} as const;

function getAccountTone(status: AdminCustomerListItem["accountStatus"]): "neutral" | "success" | "warning" | "danger" {
  if (status === "active") {
    return "success";
  }

  if (status === "pending_review") {
    return "warning";
  }

  if (status === "suspended" || status === "archived") {
    return "danger";
  }

  return "neutral";
}

export function AdminCustomers({ data }: { data: AdminCustomersData }) {
  const summaryItems = [
    {
      label: "ลูกค้าทั้งหมด",
      value: String(data.summary.total),
      tone: "neutral"
    },
    {
      label: "แบบประเมินยังใช้ได้",
      value: String(data.summary.activeAssessments),
      tone: "success"
    },
    {
      label: "ทำแล้ว รอจอง",
      value: String(data.summary.awaitingBooking),
      tone: "warning"
    },
    {
      label: "เชื่อมกับนัดหมาย",
      value: String(data.summary.booked),
      tone: "success"
    }
  ] as const;

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking sm:mx-0 sm:rounded-[8px] sm:px-6 lg:px-8 lg:py-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-label font-bold uppercase text-white/75">ข้อมูลลูกค้า</p>
            <h2 className="mt-1 font-headline text-2xl font-bold">ลูกค้าและแบบประเมิน</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
              ตรวจสถานะตั้งแต่ทำแบบประเมิน การเลือกแพทย์ การจองเวลา และการชำระค่าปรึกษาจากข้อมูลจริงในระบบ
            </p>
          </div>
          <StatusBadge tone={data.unavailable ? "danger" : "success"}>
            {data.unavailable ? "ฐานข้อมูลออฟไลน์" : "ข้อมูลจริง"}
          </StatusBadge>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4">
        {summaryItems.map((item) => (
          <div key={item.label} className="rounded-[8px] border border-border bg-white/85 p-3 shadow-payment-card lg:p-4">
            <p className="font-headline text-2xl font-bold text-text">{item.value}</p>
            <p className="mt-1 min-h-8 text-[10px] font-semibold leading-4 text-muted">{item.label}</p>
            <div className="mt-2">
              <StatusBadge tone={item.tone}>{item.label}</StatusBadge>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-[8px] border border-primary/15 bg-primary/5 p-4">
        <div className="flex gap-3">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={2.1} />
          <div>
            <h2 className="text-sm font-bold text-text">ข้อมูลสุขภาพที่จำกัดสิทธิ์</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              หน้านี้แสดงเฉพาะข้อมูลสรุป ผู้ดูแลต้องกดเข้ารายละเอียดจึงจะเห็นคำตอบแบบประเมินของลูกค้า
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-headline text-lg font-bold text-text">รายชื่อลูกค้า</h2>
          <Link href="/admin/users" className="text-xs font-bold text-primary hover:underline">
            จัดการสิทธิ์บุคลากร
          </Link>
        </div>

        {data.unavailable ? (
          <EmptyCustomers title="ยังอ่านข้อมูลลูกค้าไม่ได้" body="ตรวจการเชื่อมต่อฐานข้อมูลบนโฮสต์ แล้วเปิดหน้านี้อีกครั้ง" />
        ) : data.customers.length === 0 ? (
          <EmptyCustomers title="ยังไม่มีลูกค้า" body="ลูกค้าที่เข้าสู่ระบบด้วย LINE จะแสดงในหน้านี้โดยอัตโนมัติ" />
        ) : null}

        <div className="grid gap-3 xl:grid-cols-2">
          {data.customers.map((customer) => (
            <article key={customer.id} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
              <div className="flex gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <UserRound aria-hidden="true" className="size-5" strokeWidth={2.1} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-text">{customer.name}</h3>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-muted">{customer.reference}</p>
                    </div>
                    <StatusBadge tone={getAccountTone(customer.accountStatus)}>
                      {accountStatusLabels[customer.accountStatus]}
                    </StatusBadge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge tone={customer.latestAssessment?.isActive ? "success" : "neutral"}>
                      {customer.assessmentStatusLabel}
                    </StatusBadge>
                    <StatusBadge tone={customer.journeyTone}>{customer.journeyLabel}</StatusBadge>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <InfoTile
                  label="อาการจากแบบประเมิน"
                  value={customer.latestAssessment?.symptomLabel ?? "ยังไม่มีข้อมูล"}
                  icon={<ClipboardCheck aria-hidden="true" className="size-3.5" strokeWidth={2.1} />}
                />
                <InfoTile
                  label="หมอที่จองจริง"
                  value={customer.bookedConsultation?.doctorName ?? "ยังไม่ได้จอง"}
                  icon={<Stethoscope aria-hidden="true" className="size-3.5" strokeWidth={2.1} />}
                />
                <InfoTile
                  label="เวลานัด"
                  value={customer.bookedConsultation?.scheduledAt ?? "ยังไม่มีนัด"}
                  icon={<CalendarClock aria-hidden="true" className="size-3.5" strokeWidth={2.1} />}
                  valueClassName="whitespace-normal"
                />
                <InfoTile
                  label="สถานะค่าปรึกษา"
                  value={customer.bookedConsultation?.paymentLabel ?? "ยังไม่เริ่ม"}
                  icon={<Clock3 aria-hidden="true" className="size-3.5" strokeWidth={2.1} />}
                  valueClassName="whitespace-normal"
                />
              </div>

              {customer.latestAssessment ? (
                <div className="mt-3 rounded-[8px] bg-primary/5 px-3 py-3">
                  <p className="text-[10px] font-bold uppercase text-muted">แพทย์ที่ระบบแนะนำปัจจุบัน</p>
                  <p className="mt-1 text-xs font-bold text-primary">
                    {customer.recommendedDoctorName ?? "ยังไม่มีแพทย์ที่ผ่านการอนุมัติ"}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-muted">{customer.latestAssessment.recommendationSpecialty}</p>
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                <p className="min-w-0 truncate text-[11px] font-semibold text-muted">
                  ประเมิน {customer.assessmentCount} · นัด {customer.consultationCount} · คำสั่งซื้อ {customer.orderCount}
                </p>
                <Link
                  href={`/admin/customers/${customer.id}`}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-[8px] bg-primary px-3 text-xs font-bold text-white"
                >
                  ดูแบบประเมิน
                  <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2.1} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function EmptyCustomers({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center">
      <h3 className="text-sm font-bold text-text">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted">{body}</p>
    </div>
  );
}
