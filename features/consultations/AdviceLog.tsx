import Link from "next/link";
import type { Route } from "next";
import { CalendarDays, ClipboardList, Pill, ShoppingCart, X } from "lucide-react";
import { DoctorAvatar } from "@/features/consultations/DoctorAvatar";
import type {
  AdviceLogMedication,
  CustomerAdviceLog,
  CustomerAdviceLogData
} from "@/features/consultations/advice-log/types";

export function AdviceLog({ data }: { data: CustomerAdviceLogData }) {
  const advice = data.advice;
  const returnHref = advice?.returnHref ?? "/consult";

  return (
    <section className="-mx-4 min-h-dvh bg-advice-radial pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <AdviceTopBar returnHref={returnHref} />

      <main className="space-y-6 px-6 pt-20">
        {data.unavailable ? (
          <AdviceState
            title="ยังโหลดสรุปผลการปรึกษาไม่ได้"
            body="กรุณาลองใหม่จากหน้าปรึกษาแพทย์"
          />
        ) : advice ? (
          <>
            <DoctorSummary advice={advice} />
            <DoctorNote advice={advice} />
            <PrescriptionList medications={advice.medications} />
            <Actions advice={advice} />
          </>
        ) : (
          <AdviceState
            title="ข้อมูลนี้ถูกลบหรือไม่มีอยู่แล้ว"
            body="สรุปผลอาจถูกลบ การปรึกษายังไม่เสร็จสิ้น หรือคุณไม่มีสิทธิ์เข้าถึง"
          />
        )}
      </main>
    </section>
  );
}

function AdviceTopBar({ returnHref }: { returnHref: string }) {
  return (
    <header className="fixed inset-x-0 top-0 z-header mx-auto flex h-16 max-w-[480px] items-center bg-white/70 px-7 shadow-booking-top backdrop-blur-payment">
      <Link
        href={returnHref as Route}
        aria-label="ปิดสรุปผลการปรึกษา"
        className="flex size-10 items-center justify-start text-primary"
      >
        <X aria-hidden="true" className="size-6" strokeWidth={2.2} />
      </Link>
      <h1 className="pl-2 text-lg font-bold leading-7 tracking-normal text-primary">สรุปผลการปรึกษา</h1>
    </header>
  );
}

function DoctorSummary({ advice }: { advice: CustomerAdviceLog }) {
  return (
    <section className="rounded-[24px] border border-white/40 bg-white/70 p-6 shadow-payment-card backdrop-blur-payment">
      <div className="flex items-center gap-4">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-full border-2 border-white/50 shadow-chip">
          <DoctorAvatar src={advice.doctorAvatarUrl} alt={advice.doctorName} />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold leading-6 text-primary">{advice.doctorName}</h2>
          <p className="text-sm font-medium leading-5 text-[#3e494a]">{advice.doctorSpecialty}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs leading-4 text-[#3e494a]/70">
            <CalendarDays aria-hidden="true" className="size-4" />
            {advice.appointmentLabel}
          </p>
        </div>
      </div>
    </section>
  );
}

function DoctorNote({ advice }: { advice: CustomerAdviceLog }) {
  const summary = advice.summary ?? "ยังไม่มีบันทึกสรุปจากแพทย์สำหรับการปรึกษานี้";

  return (
    <section className="space-y-3">
      <h2 className="ml-1 text-base font-bold leading-6 text-[#191c1e]">บันทึกสรุปจากแพทย์</h2>
      <div className="rounded-[24px] bg-white p-5 shadow-chip">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#3e494a]">{summary}</p>
      </div>
    </section>
  );
}

function PrescriptionList({ medications }: { medications: AdviceLogMedication[] }) {
  return (
    <section className="space-y-3">
      <div className="ml-1 flex items-center justify-between">
        <h2 className="text-base font-bold leading-6 text-[#191c1e]">รายการยาที่สั่งจ่าย</h2>
        <span className="rounded-full bg-primary/5 px-2 py-1 text-xs font-bold uppercase tracking-wider text-primary">
          {medications.length} รายการ
        </span>
      </div>

      {medications.length > 0 ? (
        <div className="space-y-3">
          {medications.map((item, index) => (
            <article
              key={`${item.name}-${index}`}
              className="flex items-start gap-4 rounded-[24px] bg-white p-4 shadow-chip"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/5 text-primary">
                <Pill aria-hidden="true" className="size-6" strokeWidth={2.1} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-bold leading-6 text-[#191c1e]">{item.name}</h3>
                <p className="mt-1 text-sm leading-6 text-[#3e494a]">{item.details}</p>
                {item.warning ? (
                  <p className="mt-1 text-xs font-medium leading-5 text-danger">{item.warning}</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] bg-white p-5 text-sm leading-6 text-[#3e494a] shadow-chip">
          ไม่มีรายการยาที่แพทย์ออกให้สำหรับการปรึกษานี้
        </div>
      )}
    </section>
  );
}

function Actions({ advice }: { advice: CustomerAdviceLog }) {
  return (
    <section className="space-y-3 pt-4">
      {advice.prescriptionHref ? (
        <Link
          href={advice.prescriptionHref as Route}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-gradient py-4 text-base font-bold text-white shadow-selected-date"
        >
          <ShoppingCart aria-hidden="true" className="size-6" strokeWidth={2.2} />
          ดูสถานะใบสั่งยา
        </Link>
      ) : null}
      <Link
        href={advice.returnHref as Route}
        className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-primary/20 py-4 text-base font-bold text-primary"
      >
        <ClipboardList aria-hidden="true" className="size-6" strokeWidth={2.2} />
        กลับไปหน้ารายละเอียดนัดหมาย
      </Link>
    </section>
  );
}

function AdviceState({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-[24px] border border-white/50 bg-white/75 p-6 text-center shadow-payment-card backdrop-blur-payment">
      <h2 className="text-xl font-extrabold leading-7 text-primary">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#3e494a]">{body}</p>
      <Link
        href="/consult"
        className="mt-6 flex h-14 w-full items-center justify-center rounded-full bg-primary-gradient px-5 text-sm font-bold leading-5 text-white shadow-booking"
      >
        กลับไปหน้าปรึกษาแพทย์
      </Link>
    </article>
  );
}
