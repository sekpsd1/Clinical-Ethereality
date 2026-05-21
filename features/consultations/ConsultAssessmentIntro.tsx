import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";

const clinicianImageUrl = "/images/consult-assessment/intro-hero.png";

export function ConsultAssessmentIntro() {
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

        <div className="relative z-10 -mt-8 px-6 pb-8">
          <div className="flex flex-col items-center rounded-[40px] border border-white/40 bg-white/75 px-8 py-8 text-center shadow-[0_24px_70px_rgba(24,73,68,0.14)] backdrop-blur-[24px]">
            <div className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[#006067]/10 px-6 text-[#006067]">
              <Clock3 aria-hidden="true" className="size-5" strokeWidth={2.25} />
              <span className="font-label text-sm font-extrabold tracking-normal">ใช้เวลาเพียง 2 นาที</span>
            </div>

            <div className="mt-12 space-y-5">
              <h2 className="font-headline text-[2.05rem] font-extrabold leading-[1.14] tracking-normal text-[#006067]">
                ยินดีต้อนรับสู่
                <br />
                <span className="block text-[1.42rem] leading-[1.22] text-[#111827]">
                  Health & Commerce
                  <br />
                  Unified Platform
                </span>
              </h2>
              <p className="text-pretty font-body text-[1.12rem] leading-[1.76] tracking-normal text-[#3e494a]">
                แบบประเมินสั้นๆ เพียง 2 นาทีนี้จะช่วยให้เราเข้าใจความต้องการของคุณ
                เพื่อให้เราสามารถแนะนำแนวทางและผู้เชี่ยวชาญที่เหมาะสมที่สุดสำหรับคุณ
              </p>
            </div>

            <div className="mt-12 w-full space-y-7">
              <Link
                href="/consult/assessment/symptoms"
                className="flex min-h-[76px] w-full items-center justify-center gap-4 rounded-full bg-[linear-gradient(135deg,#006067_0%,#007b83_100%)] px-5 font-headline text-[1.25rem] font-extrabold tracking-normal text-white shadow-[0_18px_34px_rgba(0,96,103,0.24)] transition-transform active:scale-[0.98]"
              >
                <span className="whitespace-nowrap">เริ่มทำแบบประเมิน</span>
                <ArrowRight aria-hidden="true" className="size-8" strokeWidth={2.4} />
              </Link>

              <p className="px-4 font-label text-xs leading-6 tracking-[0.12em] text-[#6e797a]/70">
                การดำเนินการต่อแสดงว่าคุณยอมรับ{" "}
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
