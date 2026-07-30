import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardCheck,
  FileText,
  MessageCircle,
  ShieldCheck,
  UserRound
} from "lucide-react";
import { InfoTile } from "@/components/ui/InfoTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type {
  DoctorPatientConsultationDetail,
  DoctorPatientDetailData
} from "@/features/doctor/patients/detail-types";

const prescriptionStatusLabels = {
  archived: "เก็บถาวร",
  dispensed: "จ่ายยาแล้ว",
  draft: "ฉบับร่าง",
  pending_verification: "รอตรวจ",
  rejected: "ไม่อนุมัติ",
  verified: "พร้อมใช้"
} as const;

export function DoctorPatientDetail({ data }: { data: DoctorPatientDetailData }) {
  if (data.unavailable) {
    return <DetailEmptyState title="ยังอ่านข้อมูลผู้ป่วยไม่ได้" body="กรุณาตรวจการเชื่อมต่อฐานข้อมูลแล้วลองใหม่" />;
  }

  if (data.missingDoctorProfile) {
    return <DetailEmptyState title="ยังไม่มีโปรไฟล์แพทย์" body="ต้องมีโปรไฟล์แพทย์ที่อนุมัติก่อนเปิดข้อมูลผู้ป่วย" />;
  }

  if (!data.patient) {
    return <DetailEmptyState title="ไม่พบข้อมูลผู้ป่วย" body="ผู้ป่วยรายนี้ไม่ได้อยู่ในคิวที่มอบหมายให้บัญชีแพทย์ปัจจุบัน" />;
  }

  return (
    <div className="flex flex-col gap-5">
      <Link href="/doctor/patients" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-primary">
        <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={2.1} />
        กลับไปรายชื่อผู้ป่วย
      </Link>

      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-[8px] bg-white/15">
            <UserRound aria-hidden="true" className="size-6" strokeWidth={2.1} />
          </div>
          <div className="min-w-0">
            <p className="text-label font-bold uppercase text-white/75">ข้อมูลผู้ป่วยที่ได้รับมอบหมาย</p>
            <h2 className="mt-1 truncate font-headline text-2xl font-bold">{data.patient.name}</h2>
            <p className="mt-1 text-xs font-semibold text-white/75">{data.patient.reference}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[8px] border border-primary/15 bg-primary/5 p-4">
        <div className="flex gap-3">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={2.1} />
          <div>
            <h2 className="text-sm font-bold text-text">ข้อมูลสุขภาพจำกัดตามการมอบหมาย</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              หน้านี้แสดงเฉพาะคิวของแพทย์ปัจจุบัน และระบบบันทึกการเปิดข้อมูลไว้ใน audit log
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-bold text-text">ประวัติการปรึกษา</h2>
          <StatusBadge>{data.patient.consultations.length} รายการ</StatusBadge>
        </div>
        {data.patient.consultations.map((consultation) => (
          <ConsultationDetailCard key={consultation.id} consultation={consultation} />
        ))}
      </section>
    </div>
  );
}

function ConsultationDetailCard({ consultation }: { consultation: DoctorPatientConsultationDetail }) {
  return (
    <article className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase text-primary">Consultation</p>
          <p className="mt-1 text-sm font-bold text-text">{consultation.scheduledAt ?? consultation.createdAt}</p>
        </div>
        <StatusBadge tone={consultation.status === "cancelled" ? "danger" : consultation.status === "completed" ? "success" : "warning"}>
          {consultation.statusLabel}
        </StatusBadge>
      </div>

      <div className="mt-3">
        <InfoTile
          label="สรุปการปรึกษา"
          value={consultation.summary ?? "ยังไม่มีบันทึกสรุป"}
          icon={<FileText aria-hidden="true" className="size-3.5" strokeWidth={2.1} />}
          valueClassName="whitespace-normal"
        />
      </div>

      {consultation.assessment ? (
        <section className="mt-4 rounded-[8px] border border-primary/10 bg-primary/5 p-3">
          <div className="flex items-start gap-2">
            <ClipboardCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.1} />
            <div>
              <h3 className="text-sm font-bold text-primary">แบบประเมินก่อนพบแพทย์</h3>
              <p className="mt-1 text-xs leading-5 text-muted">
                {consultation.assessment.symptomLabel} • {consultation.assessment.durationLabel}
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {consultation.assessment.answers.map((answer) => (
              <InfoTile key={answer.key} label={answer.label} value={answer.value} valueClassName="whitespace-normal" />
            ))}
          </div>
          <div className="mt-3 rounded-[8px] bg-white/75 p-3 text-xs leading-5 text-muted">
            <p className="font-bold text-primary">{consultation.assessment.recommendationSpecialty}</p>
            <p className="mt-1">{consultation.assessment.recommendationReason}</p>
            <p className="mt-2 text-[10px] font-semibold">ทำเมื่อ {consultation.assessment.completedAt}</p>
          </div>
        </section>
      ) : null}

      {consultation.prescriptions.length > 0 ? (
        <section className="mt-4 rounded-[8px] border border-border/70 p-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-text">
            <FileText aria-hidden="true" className="size-4 text-primary" strokeWidth={2.1} />
            ใบสั่งยา
          </h3>
          <div className="mt-2 space-y-2">
            {consultation.prescriptions.map((prescription) => (
              <div key={prescription.id} className="rounded-[8px] bg-surface p-3 text-xs leading-5 text-muted">
                <StatusBadge>{prescriptionStatusLabels[prescription.status]}</StatusBadge>
                {prescription.medicationSummary ? (
                  <p className="mt-2 whitespace-pre-wrap font-semibold text-text">{prescription.medicationSummary}</p>
                ) : null}
                <p className="mt-2 whitespace-pre-wrap">{prescription.notes ?? "ไม่มีบันทึกเพิ่มเติม"}</p>
                <p className="mt-1 text-[10px] font-semibold">{prescription.createdAt}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {consultation.recentMessages.length > 0 ? (
        <section className="mt-4 rounded-[8px] border border-border/70 p-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-text">
            <MessageCircle aria-hidden="true" className="size-4 text-primary" strokeWidth={2.1} />
            ข้อความล่าสุด
          </h3>
          <div className="mt-2 space-y-2">
            {consultation.recentMessages.map((message) => (
              <div key={message.id} className="rounded-[8px] bg-surface p-3 text-xs leading-5 text-muted">
                <p>{message.body}</p>
                <p className="mt-1 text-[10px] font-semibold">{message.senderName} • {message.createdAt}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <p className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-muted">
        <CalendarClock aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
        สร้างเมื่อ {consultation.createdAt}
      </p>
    </article>
  );
}

function DetailEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center">
      <h2 className="text-sm font-bold text-text">{title}</h2>
      <p className="mt-2 text-xs leading-5 text-muted">{body}</p>
      <Link href="/doctor/patients" className="mt-4 inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-xs font-bold text-white">
        กลับไปรายชื่อผู้ป่วย
      </Link>
    </div>
  );
}
