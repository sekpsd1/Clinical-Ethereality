import Link from "next/link";
import { ArrowLeft, ArrowRight, MoreVertical, ShieldCheck } from "lucide-react";
import type { ActiveConsultAssessment } from "@/features/consultations/assessment/types";

export function ConsultAssessmentComplete({ assessment }: { assessment?: ActiveConsultAssessment | null }) {
  const recommendationSpecialty = assessment?.recommendationSpecialty ?? "แพทย์ที่เหมาะสม";
  const recommendationReason =
    assessment?.recommendationReason ??
    "เราได้เตรียมรายชื่อแพทย์ที่เหมาะสมที่สุดสำหรับคุณแล้ว โดยวิเคราะห์จากความต้องการเฉพาะทางและประวัติข้อมูลเบื้องต้นของคุณ";

  return (
    <section className="relative flex min-h-dvh flex-col overflow-hidden bg-[#f7f9fb] px-7 pb-[calc(3.5rem+env(safe-area-inset-bottom))] pt-24 text-[#191c1e]">
      <div className="fixed inset-x-0 top-0 z-30 mx-auto flex h-20 max-w-mobile items-center justify-between bg-[#f2f4f6]/70 px-7 shadow-[0_0_40px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/consult/assessment/duration"
            aria-label="กลับไปหน้าระยะเวลา"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#006067] transition-colors hover:bg-[#006067]/10"
          >
            <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.4} />
          </Link>
          <h1 className="truncate font-headline text-base font-extrabold tracking-normal text-[#006067]">แบบประเมินเสร็จสมบูรณ์</h1>
        </div>
        <button
          type="button"
          aria-label="เมนูเพิ่มเติม"
          className="flex size-10 items-center justify-center rounded-full text-[#006067] transition-colors hover:bg-[#006067]/10"
        >
          <MoreVertical aria-hidden="true" className="size-5" strokeWidth={2.4} />
        </button>
      </div>

      <main className="mx-auto flex w-full max-w-mobile flex-1 flex-col items-center text-center">
        <div className="w-full space-y-9 pt-8">
          <section className="space-y-6">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-white/70 text-[#006067] shadow-[0_0_40px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
              <ShieldCheck aria-hidden="true" className="size-8" strokeWidth={2.2} />
            </div>
            <div className="space-y-5">
              <h2 className="font-headline text-[2rem] font-extrabold leading-[1.1] tracking-normal text-[#006067]">
                ขอบคุณสำหรับข้อมูล
              </h2>
              <p className="mx-auto max-w-[22rem] font-body text-lg leading-8 tracking-normal text-[#3e494a]/80">
                เราแนะนำแพทย์กลุ่ม{recommendationSpecialty}ให้คุณ โดยอิงจากหัวข้อที่ประเมินและระยะเวลาของอาการ
              </p>
              <p className="mx-auto max-w-[22rem] rounded-[20px] bg-white/70 px-5 py-4 font-body text-sm italic leading-6 tracking-normal text-[#3e494a] shadow-[0_4px_24px_rgba(0,0,0,0.02)] backdrop-blur-[24px]">
                {recommendationReason}
              </p>
            </div>
          </section>

          <section className="pt-2">
            <Link
              href="/consult"
              className="flex min-h-[68px] w-full items-center justify-center gap-4 rounded-full bg-[linear-gradient(135deg,#006067_0%,#007b83_100%)] px-6 font-headline text-lg font-extrabold tracking-normal text-white shadow-[0_18px_34px_rgba(0,96,103,0.24)] transition-transform active:scale-[0.98]"
            >
              <span>ดูรายชื่อแพทย์ที่แนะนำ</span>
              <ArrowRight aria-hidden="true" className="size-7" strokeWidth={2.4} />
            </Link>
            <p className="mt-4 font-label text-sm italic leading-6 tracking-normal text-[#3e494a]/60">
              ใช้เวลาเพียง 1 นาทีในการเลือกแพทย์
            </p>
          </section>
        </div>
      </main>
    </section>
  );
}
