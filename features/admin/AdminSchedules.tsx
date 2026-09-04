import type { Route } from "next";
import { CalendarClock, Clock3, Stethoscope, ToggleRight } from "lucide-react";
import Link from "next/link";
import { InfoTile } from "@/components/ui/InfoTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminBulkScheduleEditor } from "@/features/admin/AdminBulkScheduleEditor";
import { AdminConsultationFeeSettings } from "@/features/admin/AdminConsultationFeeSettings";
import { AdminDateScheduleEditor } from "@/features/admin/AdminDateScheduleEditor";
import { AdminDateScheduleCalendar } from "@/features/admin/AdminDateScheduleCalendar";
import { AdminAppointmentCalendar } from "@/features/admin/AdminAppointmentCalendar";
import { AdminDateScheduleDeleteButton } from "@/features/admin/AdminDateScheduleDeleteButton";
import { AdminDateScheduleToggleButton } from "@/features/admin/AdminDateScheduleToggleButton";
import { AdminScheduleForm } from "@/features/admin/AdminScheduleForm";
import { AdminScheduleToggleButton } from "@/features/admin/AdminScheduleToggleButton";
import type { AdminDoctorAvailabilityDateOverride, AdminDoctorAvailabilitySlot, AdminSchedulesData } from "@/features/admin/schedules/types";

export function AdminSchedules({ data, editSlotId }: { data: AdminSchedulesData; editSlotId?: string }) {
  const editSlot = data.slots.find((slot) => slot.id === editSlotId);

  return (
    <div className="space-y-5">
      <section className="rounded-[8px] bg-primary-gradient p-5 text-white shadow-card">
        <p className="text-label font-bold uppercase text-white/75">ตารางแพทย์</p>
        <h2 className="mt-2 font-headline text-2xl font-bold">จัดการเวลาว่างสำหรับนัดหมาย</h2>
        <p className="mt-2 text-sm leading-6 text-white/80">
          กำหนดวัน เวลา และระยะเวลาต่อรอบ เพื่อให้ทีมปฏิบัติการเปิดรับนัดหมายได้อย่างปลอดภัยและตรวจสอบย้อนหลังได้
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <SummaryTile label="แพทย์พร้อมรับนัด" value={data.summary.activeDoctors} icon="doctor" />
        <SummaryTile label="ช่วงเวลาที่เปิดอยู่" value={data.summary.activeSlots} icon="active" />
        <SummaryTile label="ช่วงเวลาที่ปิดไว้" value={data.summary.inactiveSlots} icon="inactive" />
      </section>

      {data.unavailable ? (
        <section className="rounded-[8px] border border-border bg-white/85 p-4 text-sm text-muted shadow-payment-card">
          ไม่สามารถโหลดตารางแพทย์ได้ กรุณาตรวจสอบฐานข้อมูล
        </section>
      ) : null}

      <AdminDateScheduleCalendar overrides={data.dateOverrides} slots={data.slots} />

      <AdminAppointmentCalendar data={data.appointmentCalendar} />

      <AdminConsultationFeeSettings doctors={data.doctors} />

      <AdminBulkScheduleEditor doctors={data.doctors} />

      <AdminDateScheduleEditor doctors={data.doctors} />

      {editSlot ? <AdminScheduleForm key={editSlot.id} doctors={data.doctors} editSlot={editSlot} /> : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">ตารางประจำ</p><h2 className="mt-1 font-headline text-lg font-bold text-text">เวลาว่างที่ตั้งไว้</h2><p className="mt-1 text-xs text-muted">ใช้ซ้ำตามวันในสัปดาห์ และกำหนดช่วงวันที่มีผลได้</p></div>
          <StatusBadge tone={data.slots.length > 0 ? "success" : "neutral"}>{data.slots.length} รายการ</StatusBadge>
        </div>

        {!data.unavailable && data.slots.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center">
            <h3 className="text-sm font-bold text-text">ยังไม่มีเวลาว่างแพทย์</h3>
            <p className="mt-2 text-xs leading-5 text-muted">เพิ่มช่วงเวลาแรกจากฟอร์มด้านบนเพื่อเริ่มจัดตารางรับนัด</p>
          </div>
        ) : null}

        {data.slots.map((slot) => (
          <ScheduleSlotCard key={slot.id} slot={slot} />
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">ตารางรายวัน</p><h2 className="mt-1 font-headline text-lg font-bold text-text">ตารางพิเศษตามวันที่</h2><p className="mt-1 text-xs text-muted">ใช้เพิ่มเวลาพิเศษหรือปิดทั้งวัน โดยมีผลเหนือกว่าตารางประจำ</p></div>
          <StatusBadge tone={data.dateOverrides.length > 0 ? "success" : "neutral"}>{data.dateOverrides.length} รายการ</StatusBadge>
        </div>
        {data.dateOverrides.length === 0 ? <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center text-xs font-semibold text-muted">ยังไม่มีวันหยุดหรือเวลาพิเศษ</div> : null}
        {data.dateOverrides.map((override) => <DateOverrideCard key={override.id} override={override} />)}
      </section>
    </div>
  );
}

function DateOverrideCard({ override }: { override: AdminDoctorAvailabilityDateOverride }) {
  return (
    <article className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="truncate text-sm font-bold text-text">{override.doctorName}</p><p className="mt-1 text-xs font-semibold text-muted">{override.scheduleDate}</p></div>
        <StatusBadge tone={override.isActive ? "success" : "neutral"}>{override.isActive ? "เปิดอยู่" : "ปิดไว้"}</StatusBadge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <InfoTile label="ประเภท" value={override.type === "closed" ? "วันหยุด" : "เวลาพิเศษ"} density="comfortable" labelClassName="tracking-[0.08em]" valueClassName="mt-1 text-sm text-text" />
        <InfoTile label="เวลา" value={override.timeRange} density="comfortable" labelClassName="tracking-[0.08em]" valueClassName="mt-1 text-sm text-text" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3"><p className="min-w-0 truncate text-xs font-semibold text-text">{override.notes}</p><div className="flex shrink-0 items-center gap-2"><AdminDateScheduleDeleteButton overrideId={override.id} /><AdminDateScheduleToggleButton overrideId={override.id} isActive={override.isActive} /></div></div>
    </article>
  );
}

function SummaryTile({ label, value, icon }: { label: string; value: number; icon: "doctor" | "active" | "inactive" }) {
  const Icon = icon === "doctor" ? Stethoscope : icon === "active" ? CalendarClock : ToggleRight;

  return (
    <div className="rounded-[8px] border border-border bg-white/85 p-3 shadow-payment-card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase leading-4 text-muted">{label}</p>
        <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
      </div>
      <p className="mt-2 text-2xl font-bold text-text">{value}</p>
    </div>
  );
}

function ScheduleSlotCard({ slot }: { slot: AdminDoctorAvailabilitySlot }) {
  return (
    <article className="rounded-[8px] border border-border bg-white/85 p-4 shadow-payment-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-text">{slot.doctorName}</p>
          <p className="mt-1 truncate text-xs font-semibold text-muted">{slot.doctorSpecialty}</p>
        </div>
        <StatusBadge tone={slot.isActive ? "success" : "neutral"}>{slot.isActive ? "เปิดอยู่" : "ปิดไว้"}</StatusBadge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <InfoTile
          label="วัน"
          value={slot.weekdayLabel}
          density="comfortable"
          labelClassName="tracking-[0.08em]"
          valueClassName="mt-1 text-sm text-text"
        />
        <InfoTile
          label="เวลา"
          value={slot.timeRange}
          density="comfortable"
          labelClassName="tracking-[0.08em]"
          valueClassName="mt-1 text-sm text-text"
        />
        <InfoTile
          label="ระยะเวลาต่อรอบ"
          value={`${slot.slotMinutes} นาที`}
          density="comfortable"
          labelClassName="tracking-[0.08em]"
          valueClassName="mt-1 text-sm text-text"
        />
        <InfoTile label="ช่วงวันที่มีผล" value={slot.effectiveRangeLabel} density="comfortable" labelClassName="tracking-[0.08em]" valueClassName="mt-1 text-xs text-text" />
        <InfoTile
          label="อัปเดต"
          value={slot.updatedAt}
          density="comfortable"
          labelClassName="tracking-[0.08em]"
          valueClassName="mt-1 text-sm text-text"
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-muted">
            <Clock3 aria-hidden="true" className="size-3.5" />
            หมายเหตุ
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-text">{slot.notes}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/admin/schedules?edit=${encodeURIComponent(slot.id)}#schedule-form` as Route}
            className="inline-flex min-h-9 items-center justify-center rounded-[8px] border border-border bg-white px-3 text-xs font-bold text-primary"
          >
            แก้ไข
          </Link>
          <AdminScheduleToggleButton availabilityId={slot.id} isActive={slot.isActive} />
        </div>
      </div>
    </article>
  );
}
