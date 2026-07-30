import Link from "next/link";
import { ArrowRight, ClipboardList, FileText, UsersRound } from "lucide-react";
import { InfoTile } from "@/components/ui/InfoTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { DoctorPatientLogItem, DoctorPatientsData } from "@/features/doctor/patients/types";

const consultationStatusLabels: Record<string, string> = {
  cancelled: "ยกเลิกแล้ว",
  completed: "เสร็จสิ้น",
  live: "กำลังปรึกษา",
  pending_payment: "รอชำระเงิน",
  requested: "รอยืนยัน",
  scheduled: "นัดหมายแล้ว"
};

const prescriptionStatusLabels: Record<string, string> = {
  archived: "เก็บถาวร",
  dispensed: "จ่ายยาแล้ว",
  draft: "ฉบับร่าง",
  pending_verification: "แพทย์ออกแล้ว",
  rejected: "ไม่อนุมัติ",
  verified: "พร้อมสั่งซื้อ"
};

function getStatusTone(status: DoctorPatientLogItem["latestConsultationStatus"]): "neutral" | "success" | "warning" | "danger" {
  if (status === "completed") {
    return "success";
  }

  if (status === "requested" || status === "pending_payment" || status === "scheduled" || status === "live") {
    return "warning";
  }

  if (status === "cancelled") {
    return "danger";
  }

  return "neutral";
}

export function DoctorPatients({ data }: { data: DoctorPatientsData }) {
  const summaryItems = [
    {
      label: "ผู้ป่วย",
      value: String(data.summary.totalPatients),
      tone: "neutral"
    },
    {
      label: "กำลังดูแล",
      value: String(data.summary.activeConsultations),
      tone: "warning"
    },
    {
      label: "ใบสั่งยา",
      value: String(data.summary.prescriptions),
      tone: "success"
    }
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking">
        <p className="text-label font-bold uppercase text-white/75">ประวัติผู้ป่วย</p>
        <h2 className="mt-1 font-headline text-2xl font-bold">ผู้ป่วยที่ได้รับมอบหมาย</h2>
        <p className="mt-2 max-w-[340px] text-sm leading-6 text-white/80">
          ตรวจประวัติผู้ป่วยที่เกี่ยวข้องกับคิวปรึกษา พร้อมบันทึกล่าสุดและบริบทใบสั่งยา
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
          <h2 className="font-headline text-lg font-bold text-text">รายการผู้ป่วย</h2>
          <StatusBadge tone={data.unavailable || data.missingDoctorProfile ? "danger" : "success"}>
            {data.unavailable ? "ฐานข้อมูลไม่พร้อม" : data.missingDoctorProfile ? "ต้องมีโปรไฟล์แพทย์" : "พร้อมใช้งาน"}
          </StatusBadge>
        </div>

        {data.unavailable ? (
          <EmptyPatientLogs
            title="ยังโหลดข้อมูลไม่ได้"
            body="ตั้งค่าฐานข้อมูลและเตรียมโครงสร้างข้อมูลก่อนตรวจประวัติผู้ป่วย"
          />
        ) : data.missingDoctorProfile ? (
          <EmptyPatientLogs title="ยังไม่มีโปรไฟล์แพทย์" body="อนุมัติหรือสร้างโปรไฟล์แพทย์ก่อนแสดงประวัติผู้ป่วยที่ได้รับมอบหมาย" />
        ) : data.patients.length === 0 ? (
          <EmptyPatientLogs title="ยังไม่มีประวัติผู้ป่วย" body="ผู้ป่วยที่มีคิวปรึกษากับแพทย์จะแสดงที่นี่" />
        ) : null}

        {data.patients.map((patient) => {
          const tone = getStatusTone(patient.latestConsultationStatus);

          return (
            <article key={patient.id} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
              <div className="flex gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <UsersRound aria-hidden="true" className="size-5" strokeWidth={2.1} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-text">{patient.patientName}</h3>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-muted">{patient.patientLineId}</p>
                    </div>
                    {patient.latestConsultationStatus ? (
                      <StatusBadge tone={tone}>{consultationStatusLabels[patient.latestConsultationStatus]}</StatusBadge>
                    ) : null}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted">
                    {patient.latestSummary ?? "ยังไม่มีบันทึกสรุปการปรึกษา"}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <InfoTile label="คิวปรึกษา" value={`${patient.consultationCount}`} icon={<ClipboardList aria-hidden="true" className="size-3.5" strokeWidth={2.1} />} />
                <InfoTile
                  label="ใบสั่งยา"
                  value={
                    patient.latestPrescriptionStatus
                      ? `${prescriptionStatusLabels[patient.latestPrescriptionStatus]} (${patient.prescriptionCount})`
                      : "ยังไม่มี"
                  }
                  icon={<FileText aria-hidden="true" className="size-3.5" strokeWidth={2.1} />}
                />
              </div>

              <p className="mt-3 truncate border-t border-border/70 pt-3 text-[11px] font-semibold text-muted">
                นัดล่าสุด {patient.latestConsultationAt ?? "ยังไม่กำหนด"}
              </p>
              <Link
                href={`/doctor/patients/${patient.id}`}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-primary/10 px-4 text-xs font-bold text-primary"
              >
                เปิดประวัติที่ได้รับมอบหมาย
                <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2.1} />
              </Link>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function EmptyPatientLogs({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center">
      <h3 className="text-sm font-bold text-text">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted">{body}</p>
    </div>
  );
}
