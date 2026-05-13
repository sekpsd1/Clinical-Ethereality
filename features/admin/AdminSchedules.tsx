import { CalendarClock, Clock3, Stethoscope, ToggleRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminScheduleForm } from "@/features/admin/AdminScheduleForm";
import { AdminScheduleToggleButton } from "@/features/admin/AdminScheduleToggleButton";
import type { AdminDoctorAvailabilitySlot, AdminSchedulesData } from "@/features/admin/schedules/types";

export function AdminSchedules({ data }: { data: AdminSchedulesData }) {
  return (
    <div className="space-y-5">
      <section className="rounded-[8px] bg-primary-gradient p-5 text-white shadow-card">
        <p className="text-label font-bold uppercase text-white/75">ตารางแพทย์</p>
        <h2 className="mt-2 font-headline text-2xl font-bold">จัดการเวลาว่างสำหรับนัดหมาย</h2>
        <p className="mt-2 text-sm leading-6 text-white/80">
          กำหนดวัน เวลา และระยะ slot เพื่อให้ทีมปฏิบัติการเปิดรับนัดหมายได้อย่างปลอดภัยและตรวจสอบย้อนหลังได้
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <SummaryTile label="แพทย์พร้อมรับนัด" value={data.summary.activeDoctors} icon="doctor" />
        <SummaryTile label="slot เปิดอยู่" value={data.summary.activeSlots} icon="active" />
        <SummaryTile label="slot ปิดไว้" value={data.summary.inactiveSlots} icon="inactive" />
      </section>

      {data.unavailable ? (
        <section className="rounded-[8px] border border-border bg-white/85 p-4 text-sm text-muted shadow-payment-card">
          ไม่สามารถโหลดตารางแพทย์ได้ กรุณาตรวจสอบฐานข้อมูล
        </section>
      ) : null}

      <AdminScheduleForm doctors={data.doctors} />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-headline text-lg font-bold text-text">เวลาว่างที่ตั้งไว้</h2>
          <StatusBadge tone={data.slots.length > 0 ? "success" : "neutral"}>{data.slots.length} รายการ</StatusBadge>
        </div>

        {!data.unavailable && data.slots.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-border bg-white/65 p-5 text-center">
            <h3 className="text-sm font-bold text-text">ยังไม่มีเวลาว่างแพทย์</h3>
            <p className="mt-2 text-xs leading-5 text-muted">เพิ่ม slot แรกจากฟอร์มด้านบนเพื่อเริ่มจัดตารางรับนัด</p>
          </div>
        ) : null}

        {data.slots.map((slot) => (
          <ScheduleSlotCard key={slot.id} slot={slot} />
        ))}
      </section>
    </div>
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
        <InfoTile label="วัน" value={slot.weekdayLabel} />
        <InfoTile label="เวลา" value={slot.timeRange} />
        <InfoTile label="ระยะ slot" value={`${slot.slotMinutes} นาที`} />
        <InfoTile label="อัปเดต" value={slot.updatedAt} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-muted">
            <Clock3 aria-hidden="true" className="size-3.5" />
            หมายเหตุ
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-text">{slot.notes}</p>
        </div>
        <AdminScheduleToggleButton availabilityId={slot.id} isActive={slot.isActive} />
      </div>
    </article>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-primary/5 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-text">{value}</p>
    </div>
  );
}
