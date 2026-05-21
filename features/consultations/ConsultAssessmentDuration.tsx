"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, History, Info, MoreVertical } from "lucide-react";
import { cn } from "@/lib/design-system/variants";

const durationOptions = [
  {
    id: "less24h",
    title: "น้อยกว่า 24 ชม.",
    description: "อาการเพิ่งเริ่มเกิดขึ้นภายในหนึ่งวัน",
    icon: Clock3
  },
  {
    id: "1-3days",
    title: "1-3 วัน",
    description: "มีอาการต่อเนื่องมาแล้วสองถึงสามวัน",
    icon: CalendarDays
  },
  {
    id: "more3days",
    title: "มากกว่า 3 วัน",
    description: "มีอาการเรื้อรังหรือต่อเนื่องเกินสามวันขึ้นไป",
    icon: History
  }
] as const;

export function ConsultAssessmentDuration() {
  const router = useRouter();
  const [selectedDuration, setSelectedDuration] = useState<string | null>(null);

  return (
    <section className="relative min-h-dvh overflow-hidden bg-[#f7f9fb] px-6 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-28 text-[#191c1e]">
      <div className="fixed inset-x-0 top-0 z-30 mx-auto flex h-20 max-w-mobile items-center justify-between bg-[#f2f4f6]/70 px-7 shadow-[0_0_40px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/consult/assessment/symptoms"
            aria-label="กลับไปหน้าอาการเบื้องต้น"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#006067] transition-colors hover:bg-[#006067]/10"
          >
            <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.4} />
          </Link>
          <h1 className="truncate font-headline text-base font-extrabold tracking-normal text-[#006067]">แบบประเมิน - ระยะเวลา</h1>
        </div>
        <button
          type="button"
          aria-label="เมนูเพิ่มเติม"
          className="flex size-10 items-center justify-center rounded-full text-[#3e494a] transition-colors hover:bg-[#006067]/10"
        >
          <MoreVertical aria-hidden="true" className="size-5" strokeWidth={2.4} />
        </button>
      </div>

      <main className="mx-auto flex w-full max-w-mobile flex-col">
        <div className="mb-12">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <span className="block font-label text-sm font-extrabold uppercase tracking-[0.12em] text-[#006067]">ขั้นตอนที่ 2 จาก 3</span>
              <span className="mt-1 block font-headline text-2xl font-semibold leading-tight tracking-normal text-[#3e494a]">
                ระยะเวลาของอาการ
              </span>
            </div>
            <span className="shrink-0 font-label text-lg font-extrabold tracking-normal text-[#006067]">66%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#e6e8ea]">
            <div className="h-full w-[66%] rounded-full bg-[linear-gradient(90deg,#006067_0%,#007b83_100%)] shadow-[0_0_12px_rgba(0,96,103,0.3)]" />
          </div>
        </div>

        <section className="mb-10">
          <h2 className="font-headline text-[2rem] font-extrabold leading-[1.12] tracking-normal text-[#191c1e]">
            คุณมีอาการเหล่านี้มานานแค่ไหนแล้ว?
          </h2>
        </section>

        <div className="grid gap-5" role="radiogroup" aria-label="เลือกระยะเวลาของอาการ">
          {durationOptions.map((option) => {
            const Icon = option.icon;
            const active = selectedDuration === option.id;

            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelectedDuration(option.id)}
                className={cn(
                  "group relative flex min-h-[100px] w-full items-center gap-5 rounded-[24px] border bg-white/70 p-6 text-left shadow-[0_4px_24px_rgba(0,0,0,0.02)] backdrop-blur-[24px] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_40px_rgba(0,96,103,0.05)]",
                  active ? "border-2 border-[#006067]/30 bg-[#006067]/[0.04]" : "border-[#bdc9ca]/15"
                )}
              >
                <span
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-full text-[#006067] transition-colors",
                    active ? "bg-[#006067] text-white" : "bg-[#eceef0] group-hover:bg-[#006067]/10"
                  )}
                >
                  <Icon aria-hidden="true" className="size-6" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block font-headline text-xl font-extrabold tracking-normal text-[#191c1e]", active && "text-[#006067]")}>
                    {option.title}
                  </span>
                  <span className="mt-1 block font-body text-sm leading-6 tracking-normal text-[#3e494a]">{option.description}</span>
                </span>
                <CheckCircle2
                  aria-hidden="true"
                  className={cn("size-6 shrink-0 text-[#006067] transition-opacity", active ? "opacity-100" : "opacity-0")}
                  strokeWidth={2.4}
                />
              </button>
            );
          })}
        </div>

        <aside className="mt-10 rounded-[24px] border border-[#006067] bg-white/70 p-6 text-[#3e494a] shadow-[0_4px_24px_rgba(0,0,0,0.02)] backdrop-blur-[24px]">
          <div className="flex gap-4">
            <Info aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-[#006067]" strokeWidth={2.4} />
            <p className="font-body text-sm italic leading-7 tracking-normal">
              ข้อมูลระยะเวลาของอาการมีความสำคัญต่อการวินิจฉัยความรุนแรงของโรคและการวางแผนการรักษาที่เหมาะสมสำหรับคุณ
            </p>
          </div>
        </aside>
      </main>

      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_0%_0%,rgba(0,96,103,0.05)_0,transparent_50%),radial-gradient(circle_at_100%_100%,rgba(0,96,103,0.03)_0,transparent_50%)]" />

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-mobile items-center justify-between rounded-t-[24px] bg-[#f2f4f6]/80 px-8 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-10px_40px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
        <Link
          href="/consult/assessment/symptoms"
          className="flex min-w-14 flex-col items-center justify-center gap-1 px-3 py-2 text-[#3e494a]/80 transition-colors hover:text-[#006067]"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
          <span className="font-label text-xs">Previous</span>
        </Link>
        <button
          type="button"
          disabled={!selectedDuration}
          onClick={() => {
            if (selectedDuration) {
              router.push("/consult/assessment/complete");
            }
          }}
          className={cn(
            "flex min-w-14 flex-col items-center justify-center gap-1 px-3 py-2 transition-all",
            selectedDuration
              ? "scale-105 rounded-full bg-[#006067] px-8 text-white shadow-lg shadow-[#006067]/20"
              : "cursor-not-allowed text-[#3e494a]/40"
          )}
        >
          <span className="flex items-center gap-1">
            {selectedDuration ? <span className="font-label text-xs font-extrabold">Next</span> : null}
            <ChevronRight aria-hidden="true" className="size-5" />
          </span>
          {selectedDuration ? null : <span className="font-label text-xs">Next</span>}
        </button>
      </nav>
    </section>
  );
}
