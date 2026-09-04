import {
  ArrowLeft,
  CalendarClock,
  ClipboardCheck,
  Clock3,
  Mail,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Stethoscope,
  UserRound
} from "lucide-react";
import Link from "next/link";
import { InfoTile } from "@/components/ui/InfoTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminCustomerAssessmentResetButton } from "@/features/admin/AdminCustomerAssessmentResetButton";
import { AdminStaffFileControls } from "@/features/admin/AdminStaffFileControls";
import { AdminUserActionButtons } from "@/features/admin/AdminUserActionButtons";
import type { AdminCustomerDetailData } from "@/features/admin/customers/types";

const accountStatusLabels = {
  active: "ใช้งานอยู่",
  archived: "เก็บถาวร",
  pending_review: "รอตรวจสอบ",
  suspended: "ระงับใช้งาน"
} as const;

export function AdminCustomerDetail({ data, currentUserId }: { data: AdminCustomerDetailData; currentUserId: string }) {
  if (data.unavailable) {
    return (
      <DetailEmptyState
        title="ยังอ่านข้อมูลลูกค้าไม่ได้"
        body="ตรวจการเชื่อมต่อฐานข้อมูลบนโฮสต์ แล้วเปิดหน้านี้อีกครั้ง"
      />
    );
  }

  if (!data.customer) {
    return (
      <DetailEmptyState
        title="ไม่พบข้อมูลลูกค้า"
        body="รายการนี้อาจไม่มีอยู่ หรือไม่ใช่บัญชีลูกค้า"
      />
    );
  }

  const customer = data.customer;
  const latestAssessment = customer.assessments[0] ?? null;
  const linkedConsultation = latestAssessment?.linkedConsultationId
    ? customer.consultations.find((consultation) => consultation.id === latestAssessment.linkedConsultationId) ?? null
    : null;

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <Link href="/admin/customers" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-primary">
        <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={2.1} />
        กลับไปรายชื่อลูกค้า
      </Link>

      <section className="-mx-4 bg-primary-gradient px-4 py-5 text-white shadow-booking sm:mx-0 sm:rounded-[8px] sm:px-6 lg:px-8 lg:py-7">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-[8px] bg-white/15">
            <UserRound aria-hidden="true" className="size-6" strokeWidth={2.1} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-label font-bold uppercase text-white/75">รายละเอียดลูกค้า</p>
            <h2 className="mt-1 truncate font-headline text-2xl font-bold">{customer.name}</h2>
            <p className="mt-1 text-xs font-semibold text-white/75">{customer.reference}</p>
          </div>
          <StatusBadge tone={customer.accountStatus === "active" ? "success" : "warning"}>
            {accountStatusLabels[customer.accountStatus]}
          </StatusBadge>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4">
        <InfoTile
          label="อีเมล"
          value={customer.email ?? "ยังไม่ระบุ"}
          icon={<Mail aria-hidden="true" className="size-3.5" strokeWidth={2.1} />}
          density="comfortable"
          valueClassName="whitespace-normal"
        />
        <InfoTile
          label="โทรศัพท์"
          value={customer.phone ?? "ยังไม่ระบุ"}
          icon={<Phone aria-hidden="true" className="size-3.5" strokeWidth={2.1} />}
          density="comfortable"
        />
        <InfoTile
          label="เข้าใช้ล่าสุด"
          value={customer.lastLoginAt ?? "ยังไม่มีข้อมูล"}
          icon={<Clock3 aria-hidden="true" className="size-3.5" strokeWidth={2.1} />}
          density="comfortable"
          valueClassName="whitespace-normal"
        />
        <InfoTile
          label="คำสั่งซื้อ"
          value={`${customer.orderCount} รายการ`}
          icon={<ShoppingBag aria-hidden="true" className="size-3.5" strokeWidth={2.1} />}
          density="comfortable"
        />
      </section>

      <section className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card lg:p-5">
        <div className="flex flex-col gap-3 border-b border-border/70 pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-label font-bold uppercase text-primary">สิทธิ์ผู้ใช้งาน</p>
            <h2 className="mt-1 font-headline text-lg font-bold text-text">เปลี่ยนสิทธิ์ผู้ใช้</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              เลือกได้ทุกบทบาท ยกเว้นบัญชีผู้ดูแลที่กำลังใช้งานอยู่ และผู้ดูแลระบบคนสุดท้าย
            </p>
          </div>
          <AdminUserActionButtons
            isCurrentUser={customer.id === currentUserId}
            redirectOnRoleChange="/admin/users?status=approved"
            user={{
              id: customer.id,
              name: customer.name,
              currentRole: customer.role,
              requestedRole: customer.role,
              status: customer.accountStatus
            }}
          />
        </div>
        <div className="mt-4">
          <p className="text-xs font-bold text-text">เอกสารสำหรับสิทธิ์วิชาชีพ</p>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-muted">
            หากกำหนดสิทธิ์เป็นแพทย์หรือเภสัชกร ต้องอัปโหลดรูปโปรไฟล์ทางการและเอกสารใบอนุญาตให้ครบก่อนกดบันทึกสิทธิ์
          </p>
          <AdminStaffFileControls
            licenseProofName={customer.licenseProofName}
            licenseProofUrl={customer.licenseProofUrl}
            profilePhotoName={customer.profilePhotoName}
            profilePhotoUrl={customer.profilePhotoUrl}
            userId={customer.id}
            userName={customer.name}
          />
        </div>
      </section>

      <section className="rounded-[8px] border border-primary/15 bg-primary/5 p-4">
        <div className="flex gap-3">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={2.1} />
          <div>
            <h2 className="text-sm font-bold text-text">ใช้เพื่อสนับสนุนงานคลินิกเท่านั้น</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              แบบประเมินเป็นข้อมูลสุขภาพ หมอจะเห็นเมื่อข้อมูลถูกผูกกับนัดหมายของตน ส่วนผู้ดูแลเห็นหน้านี้เพื่อประสานงานและตรวจสอบโฟลว์
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card lg:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-label font-bold uppercase text-primary">แบบประเมินล่าสุด</p>
            <h2 className="mt-1 font-headline text-lg font-bold text-text">
              {latestAssessment ? latestAssessment.recommendationTopic : "ยังไม่มีแบบประเมิน"}
            </h2>
          </div>
          <StatusBadge tone={latestAssessment?.isActive ? "success" : "neutral"}>
            {latestAssessment ? (latestAssessment.isActive ? "ยังใช้ได้" : "หมดอายุ") : "ยังไม่ทำ"}
          </StatusBadge>
        </div>

        {latestAssessment ? (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <InfoTile
                label="อาการหลัก"
                value={latestAssessment.symptomLabel}
                icon={<ClipboardCheck aria-hidden="true" className="size-3.5" strokeWidth={2.1} />}
                descriptionList
              />
              <InfoTile
                label="ระยะเวลา"
                value={latestAssessment.durationLabel}
                icon={<Clock3 aria-hidden="true" className="size-3.5" strokeWidth={2.1} />}
                descriptionList
              />
            </dl>

            <div className="mt-3 rounded-[8px] border border-border/70 bg-white p-4">
              <p className="text-[10px] font-bold uppercase text-muted">คำแนะนำจากระบบ</p>
              <p className="mt-1 text-sm font-bold text-primary">{latestAssessment.recommendationSpecialty}</p>
              <p className="mt-2 text-xs leading-5 text-muted">{latestAssessment.recommendationReason}</p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <InfoTile
                label="แพทย์ที่ระบบแนะนำปัจจุบัน"
                value={customer.recommendedDoctorName ?? "ยังไม่มีแพทย์ที่อนุมัติ"}
                icon={<Stethoscope aria-hidden="true" className="size-3.5" strokeWidth={2.1} />}
                valueClassName="whitespace-normal"
              />
              <InfoTile
                label="แพทย์ที่จองจริง"
                value={linkedConsultation?.doctorName ?? "ยังไม่ได้จอง"}
                icon={<CalendarClock aria-hidden="true" className="size-3.5" strokeWidth={2.1} />}
                valueClassName="whitespace-normal"
              />
            </div>

            <div className="mt-4 flex flex-col gap-1 border-t border-border/70 pt-3 text-[11px] font-semibold text-muted sm:flex-row sm:justify-between">
              <span>ทำเมื่อ {latestAssessment.completedAt}</span>
              <span>ใช้ได้ถึง {latestAssessment.expiresAt}</span>
            </div>

            {latestAssessment.isActive ? (
              <AdminCustomerAssessmentResetButton customerId={customer.id} customerName={customer.name} />
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted">ลูกค้ายังไม่ได้ส่งแบบประเมินก่อนปรึกษา</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-bold text-text">ประวัตินัดหมาย</h2>
          <StatusBadge>{customer.consultations.length} รายการ</StatusBadge>
        </div>

        {customer.consultations.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center">
            <h3 className="text-sm font-bold text-text">ยังไม่มีนัดหมาย</h3>
            <p className="mt-2 text-xs leading-5 text-muted">เมื่อลูกค้าจองหมอ แบบประเมินที่ยังใช้ได้จะถูกผูกกับนัดหมาย</p>
          </div>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-2">
          {customer.consultations.map((consultation) => (
            <article key={consultation.id} className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-text">{consultation.doctorName}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted">{consultation.doctorSpecialty}</p>
                </div>
                <StatusBadge tone={consultation.tone}>{consultation.statusLabel}</StatusBadge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <InfoTile
                  label="วันและเวลา"
                  value={consultation.scheduledAt ?? "ยังไม่กำหนด"}
                  icon={<CalendarClock aria-hidden="true" className="size-3.5" strokeWidth={2.1} />}
                  valueClassName="whitespace-normal"
                />
                <InfoTile
                  label="ค่าปรึกษา"
                  value={consultation.paymentLabel}
                  icon={<Clock3 aria-hidden="true" className="size-3.5" strokeWidth={2.1} />}
                  valueClassName="whitespace-normal"
                />
              </div>
              <p className="mt-3 text-[11px] font-semibold text-muted">
                {consultation.assessmentId ? "มีแบบประเมินผูกกับนัดหมาย" : "นัดหมายนี้ไม่มีแบบประเมิน"}
              </p>
            </article>
          ))}
        </div>
      </section>

      {customer.assessments.length > 1 ? (
        <section className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-lg font-bold text-text">ประวัติแบบประเมิน</h2>
            <StatusBadge>{customer.assessments.length} รายการล่าสุด</StatusBadge>
          </div>
          <div className="mt-3 flex flex-col">
            {customer.assessments.slice(1).map((assessment) => (
              <div key={assessment.id} className="flex items-start justify-between gap-3 border-t border-border/70 py-3 first:border-t-0">
                <div>
                  <p className="text-sm font-bold text-text">{assessment.symptomLabel}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {assessment.durationLabel} · {assessment.completedAt}
                  </p>
                </div>
                <StatusBadge tone={assessment.isActive ? "success" : "neutral"}>
                  {assessment.isActive ? "ยังใช้ได้" : "หมดอายุ"}
                </StatusBadge>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function DetailEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/customers" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-primary">
        <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={2.1} />
        กลับไปรายชื่อลูกค้า
      </Link>
      <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-6 text-center">
        <h2 className="font-headline text-lg font-bold text-text">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
      </div>
    </div>
  );
}
