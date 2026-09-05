import { CalendarClock, Stethoscope, ToggleRight } from "lucide-react";
import { AdminConsultationFeeSettings } from "@/features/admin/AdminConsultationFeeSettings";
import { AdminAppointmentCalendar } from "@/features/admin/AdminAppointmentCalendar";
import { AdminScheduleForm } from "@/features/admin/AdminScheduleForm";
import type { AdminSchedulesData } from "@/features/admin/schedules/types";

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

      <AdminAppointmentCalendar data={data.appointmentCalendar} manualAppointmentPatients={data.manualAppointmentPatients} workingHoursDoctors={data.doctors} dateOverrides={data.dateOverrides} />

      <AdminConsultationFeeSettings doctors={data.doctors} />

      {editSlot ? <AdminScheduleForm key={editSlot.id} doctors={data.doctors} editSlot={editSlot} /> : null}

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

