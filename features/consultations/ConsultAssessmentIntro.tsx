import Link from "next/link";
import { ArrowRight, Clock3, ShieldCheck } from "lucide-react";
import { acceptConsultAssessmentHealthConsentAction } from "@/features/consultations/assessment/actions";
import {
  CONSULT_ASSESSMENT_HEALTH_CONSENT_VERSION,
  consultAssessmentHealthConsent
} from "@/features/consultations/assessment/consent";

const clinicianImageUrl = "/images/consult-assessment/intro-hero.png";

export function ConsultAssessmentIntro({
  doctorId,
  consentRequired = false
}: {
  doctorId?: string | null;
  consentRequired?: boolean;
}) {
  return (
    <section className="relative min-h-dvh w-full overflow-hidden bg-[#f7f9fb] text-[#191c1e]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#d0fbff_0%,#f7f9fb_42%,#ffffff_100%)]" />

      <div className="relative min-h-dvh">
        <h1 className="sr-only">แบบประเมิน Aura Health</h1>
        <div className="relative h-[31dvh] min-h-[220px] w-full">
          <div
            role="img"
            aria-label="แพทย์หญิงในห้องตรวจ"
            className="h-full w-full bg-cover bg-center"
            style={{
              backgroundImage: `url("${clinicianImageUrl}")`
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f7f9fb] via-transparent to-transparent" />
        </div>

        <div className="relative z-10 -mt-8 px-3 pb-6">
          <div className="flex min-w-0 flex-col items-center break-words rounded-[40px] border border-white/40 bg-white/75 px-4 py-6 text-center shadow-[0_24px_70px_rgba(24,73,68,0.14)] backdrop-blur-[24px]">
            <div className="inline-flex min-h-12 max-w-full items-center gap-2 rounded-full bg-[#006067]/10 px-4 py-2 text-[#006067]">
              <Clock3 aria-hidden="true" className="size-5 shrink-0" strokeWidth={2.25} />
              <span className="min-w-0 font-label text-sm font-extrabold tracking-normal">ใช้เวลาเพียง 2 นาที</span>
            </div>

            <div className="mt-6 w-full min-w-0 space-y-3">
              <h2 className="font-headline text-[1.78rem] font-extrabold leading-[1.18] tracking-normal text-[#006067]">
                ยินดีต้อนรับสู่
                <br />
                <span className="block text-[1.2rem] leading-[1.28] text-[#111827]">
                  Health & Commerce
                  <br />
                  Unified Platform
                </span>
              </h2>
              <p className="text-pretty font-body text-[1rem] leading-[1.7] tracking-normal text-[#3e494a]">
                แบบประเมินสั้นๆ เพียง 2 นาทีนี้จะช่วยให้เราเข้าใจความต้องการของคุณ
                เพื่อให้เราสามารถแนะนำแนวทางและผู้เชี่ยวชาญที่เหมาะสมที่สุดสำหรับคุณ
              </p>
            </div>

            <div className="mt-6 w-full min-w-0 space-y-4 text-left">
              <div className="rounded-[24px] border border-[#006067]/15 bg-white/70 p-4">
                <div className="flex flex-wrap items-start gap-2">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-[#006067]" strokeWidth={2.2} />
                  <h3 className="min-w-0 flex-1 basis-48 font-headline text-base font-extrabold text-[#191c1e]">
                    {consultAssessmentHealthConsent.title}
                  </h3>
                </div>
                <p className="mt-2 font-body text-sm leading-6 text-[#3e494a]">
                  {consultAssessmentHealthConsent.summary}
                </p>
                <ul className="mt-3 space-y-2 pl-5 font-body text-sm leading-6 text-[#3e494a]">
                  {consultAssessmentHealthConsent.bullets.map((bullet) => (
                    <li key={bullet} className="list-disc">
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>

              {consentRequired ? (
                <p role="alert" className="rounded-[16px] bg-[#fff4e5] px-4 py-3 text-center font-body text-sm text-[#7a4b00]">
                  กรุณายืนยันความยินยอมก่อนแจ้งอาการ
                </p>
              ) : null}

              <form action={acceptConsultAssessmentHealthConsentAction} className="space-y-4">
                <input type="hidden" name="version" value={CONSULT_ASSESSMENT_HEALTH_CONSENT_VERSION} />
                {doctorId ? <input type="hidden" name="doctorId" value={doctorId} /> : null}
                <label className="flex cursor-pointer items-start gap-3 rounded-[20px] border border-[#006067]/20 bg-white px-3 py-3">
                  <input
                    type="checkbox"
                    name="healthDataConsentAccepted"
                    required
                    className="mt-1 size-5 shrink-0 accent-[#006067]"
                  />
                  <span className="min-w-0 font-body text-sm leading-6 text-[#3e494a]">
                    ข้าพเจ้าได้อ่านและยินยอมให้เก็บและใช้ข้อมูลอาการและข้อมูลสุขภาพตามวัตถุประสงค์ข้างต้น
                  </span>
                </label>

                <button
                  type="submit"
                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#006067_0%,#007b83_100%)] px-4 py-3 font-headline text-base font-extrabold tracking-normal text-white shadow-[0_18px_34px_rgba(0,96,103,0.24)] transition-transform active:scale-[0.98]"
                >
                  <span className="min-w-0">ยินยอมและแจ้งอาการ</span>
                  <ArrowRight aria-hidden="true" className="size-6 shrink-0" strokeWidth={2.4} />
                </button>
              </form>

              <p className="px-1 text-center font-label text-sm leading-6 tracking-normal text-[#6e797a]/70">
                อ่านรายละเอียดเพิ่มเติมใน{" "}
                <Link href="/profile/settings?section=privacy" className="underline decoration-[#006067]/30 underline-offset-4">
                  นโยบายความเป็นส่วนตัว
                </Link>{" "}
                ของเรา
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
