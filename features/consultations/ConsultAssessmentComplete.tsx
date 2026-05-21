import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MoreVertical, ShieldCheck } from "lucide-react";

const recommendedDoctors = [
  {
    name: "นพ. วิทวัส สมใจ",
    specialty: "ผู้เชี่ยวชาญด้านอายุรกรรม",
    imageSrc: "/images/doctors/somchai.png"
  },
  {
    name: "พญ. ณิชา อัครวัฒน์",
    specialty: "ผู้เชี่ยวชาญด้านผิวหนัง",
    imageSrc: "/images/doctors/nicha.png"
  }
] as const;

export function ConsultAssessmentComplete() {
  return (
    <section className="relative flex min-h-dvh flex-col overflow-hidden bg-[#f7f9fb] px-7 pb-[calc(3.5rem+env(safe-area-inset-bottom))] pt-28 text-[#191c1e]">
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

      <main className="mx-auto flex w-full max-w-mobile flex-1 flex-col items-center justify-center text-center">
        <div className="w-full space-y-9">
          <section className="space-y-6">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-white/70 text-[#006067] shadow-[0_0_40px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
              <ShieldCheck aria-hidden="true" className="size-8" strokeWidth={2.2} />
            </div>
            <div className="space-y-5">
              <h2 className="font-headline text-[2rem] font-extrabold leading-[1.1] tracking-normal text-[#006067]">
                ขอบคุณสำหรับข้อมูล
              </h2>
              <p className="mx-auto max-w-[22rem] font-body text-lg leading-8 tracking-normal text-[#3e494a]/80">
                เราได้เตรียมรายชื่อแพทย์ที่เหมาะสมที่สุดสำหรับคุณแล้ว โดยวิเคราะห์จากความต้องการเฉพาะทางและประวัติข้อมูลเบื้องต้นของคุณ
              </p>
            </div>
          </section>

          <section className="grid gap-6" aria-label="รายชื่อแพทย์ที่แนะนำ">
            {recommendedDoctors.map((doctor) => (
              <article
                key={doctor.name}
                className="flex min-h-[112px] items-center gap-5 rounded-[24px] border border-[#bdc9ca]/15 bg-white/75 p-6 text-left shadow-[0_4px_24px_rgba(0,0,0,0.02)] backdrop-blur-[24px]"
              >
                <div className="relative size-16 shrink-0 overflow-hidden rounded-full shadow-sm">
                  <Image src={doctor.imageSrc} alt={doctor.name} fill sizes="64px" className="object-cover" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-headline text-base font-extrabold leading-6 tracking-normal text-[#191c1e]">{doctor.name}</h3>
                  <p className="font-body text-sm leading-5 tracking-normal text-[#3e494a]">{doctor.specialty}</p>
                </div>
              </article>
            ))}
          </section>

          <section className="pt-4">
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
