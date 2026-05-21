"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Brain, ChevronLeft, ChevronRight, MoreHorizontal, MoreVertical, Thermometer, Waves } from "lucide-react";
import { cn } from "@/lib/design-system/variants";

const symptomOptions = [
  {
    id: "headache",
    title: "ปวดหัว",
    description: "รู้สึกหนักหัว หรือปวดตุบๆ",
    icon: Brain
  },
  {
    id: "fever",
    title: "ไข้/หนาวสั่น",
    description: "ตัวร้อน ครั่นเนื้อครั่นตัว",
    icon: Thermometer
  },
  {
    id: "cough",
    title: "ไอ/เจ็บคอ",
    description: "ระคายเคืองคอ มีเสมหะ",
    icon: Waves
  },
  {
    id: "other",
    title: "อื่นๆ",
    description: "ระบุอาการเพิ่มเติมภายหลัง",
    icon: MoreHorizontal
  }
] as const;

export function ConsultAssessmentSymptoms() {
  const router = useRouter();
  const [selectedSymptom, setSelectedSymptom] = useState<string | null>(null);

  return (
    <section className="relative min-h-dvh overflow-hidden bg-[#f7f9fb] px-6 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-28 text-[#191c1e]">
      <div className="fixed inset-x-0 top-0 z-30 mx-auto flex h-20 max-w-mobile items-center justify-between bg-[#f2f4f6]/70 px-7 shadow-[0_0_40px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/consult/assessment"
            aria-label="กลับไปหน้าเริ่มต้นแบบประเมิน"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#006067] transition-colors hover:bg-[#006067]/10"
          >
            <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.4} />
          </Link>
          <h1 className="truncate font-headline text-base font-extrabold tracking-normal text-[#006067]">แบบประเมินอาการ</h1>
        </div>
        <button
          type="button"
          aria-label="เมนูเพิ่มเติม"
          className="flex size-10 items-center justify-center rounded-full text-[#006067] transition-colors hover:bg-[#006067]/10"
        >
          <MoreVertical aria-hidden="true" className="size-5" strokeWidth={2.4} />
        </button>
      </div>

      <main className="mx-auto flex w-full max-w-mobile flex-col">
        <div className="mb-12">
          <div className="mb-4 flex items-end justify-between">
            <span className="font-headline text-xl font-extrabold tracking-normal text-[#006067]">ขั้นตอนที่ 1 จาก 3</span>
            <span className="font-label text-sm tracking-normal text-[#3e494a]/60">33% สำเร็จ</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#e6e8ea]">
            <div className="h-full w-1/3 rounded-full bg-[linear-gradient(90deg,#006067_0%,#007b83_100%)] shadow-[0_0_12px_rgba(0,96,103,0.3)]" />
          </div>
        </div>

        <section className="mb-12">
          <h2 className="font-headline text-[2rem] font-extrabold leading-[1.08] tracking-normal text-[#191c1e]">
            อาการเบื้องต้นที่คุณรู้สึกตอนนี้คืออะไร?
          </h2>
          <p className="mt-6 font-body text-base leading-7 tracking-normal text-[#3e494a]">
            โปรดเลือกอาการหลักที่รบกวนคุณมากที่สุดในขณะนี้ เพื่อให้แพทย์สามารถประเมินผลเบื้องต้นได้อย่างแม่นยำ
          </p>
        </section>

        <div className="grid gap-6" role="radiogroup" aria-label="เลือกอาการเบื้องต้น">
          {symptomOptions.map((option) => {
            const Icon = option.icon;
            const active = selectedSymptom === option.id;

            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelectedSymptom(option.id)}
                className={cn(
                  "group flex min-h-[128px] w-full items-center gap-6 rounded-[24px] border bg-white p-8 text-left shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(0,96,103,0.08)]",
                  active ? "-translate-y-1 border-2 border-[#006067] bg-[#006067]/[0.04]" : "border-[#bdc9ca]/15"
                )}
              >
                <span
                  className={cn(
                    "flex size-16 shrink-0 items-center justify-center rounded-[20px] text-[#006067] transition-colors",
                    active ? "bg-[#006067]/20" : "bg-[#006067]/5 group-hover:bg-[#006067]/10"
                  )}
                >
                  <Icon aria-hidden="true" className="size-9" strokeWidth={2.2} />
                </span>
                <span className="min-w-0">
                  <span className="block font-headline text-xl font-extrabold tracking-normal text-[#191c1e]">{option.title}</span>
                  <span className="mt-2 block font-body text-sm leading-5 tracking-normal text-[#3e494a]/70">{option.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </main>

      <div className="pointer-events-none fixed bottom-0 right-0 -z-10 size-[420px] translate-x-1/3 translate-y-1/3 rounded-full bg-[#006067]/5 blur-[100px]" />

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-mobile items-center justify-between rounded-t-[24px] bg-[#f2f4f6]/80 px-8 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-10px_40px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
        <Link
          href="/consult/assessment"
          className="flex min-w-14 flex-col items-center justify-center gap-1 px-3 py-2 text-[#3e494a]/80 transition-colors hover:text-[#006067]"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
          <span className="font-label text-xs">Previous</span>
        </Link>
        <button
          type="button"
          disabled={!selectedSymptom}
          onClick={() => {
            if (selectedSymptom) {
              router.push("/consult/assessment/duration");
            }
          }}
          className={cn(
            "flex min-w-14 flex-col items-center justify-center gap-1 px-3 py-2 transition-all",
            selectedSymptom
              ? "scale-105 rounded-full bg-[#006067] px-8 text-white shadow-lg shadow-[#006067]/20"
              : "cursor-not-allowed text-[#3e494a]/40"
          )}
        >
          <ChevronRight aria-hidden="true" className="size-5" />
          <span className="font-label text-xs">{selectedSymptom ? "Next Step" : "Next"}</span>
        </button>
      </nav>
    </section>
  );
}
