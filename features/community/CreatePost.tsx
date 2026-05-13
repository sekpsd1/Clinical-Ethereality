import Link from "next/link";
import { ArrowLeft, Camera, Send } from "lucide-react";

const categories = ["โรคทั่วไป", "วิตามิน & อาหารเสริม", "การดูแลผิว", "ปรึกษาหมอ"];

export function CreatePost() {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_right,#e0f2f1_0%,#f7f9fb_100%)] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <CreatePostHeader />

      <main className="mx-auto flex w-full max-w-mobile flex-col px-6 pb-10 pt-[140px]">
        <section className="rounded-[24px] border border-white/20 bg-white/70 p-6 shadow-[0_20px_50px_rgba(0,96,103,0.12)] backdrop-blur-[10px]">
          <div className="space-y-7">
            <label className="block space-y-3">
              <span className="ml-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">หัวข้อกระทู้</span>
              <input
                type="text"
                placeholder="ระบุหัวข้อที่น่าสนใจ..."
                className="h-[82px] w-full rounded-[16px] border-0 bg-[#e6e8ea]/50 px-5 text-[20px] text-[#191c1e] outline-none placeholder:text-[#3e494a]/45 focus:ring-2 focus:ring-[#7ad5dd]"
              />
            </label>

            <label className="block space-y-3">
              <span className="ml-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">เนื้อหากระทู้</span>
              <textarea
                rows={6}
                placeholder="แบ่งปันประสบการณ์หรือคำถามของคุณที่นี่..."
                className="min-h-[256px] w-full resize-none rounded-[16px] border-0 bg-[#e6e8ea]/50 p-5 text-[20px] leading-8 text-[#191c1e] outline-none placeholder:text-[#3e494a]/45 focus:ring-2 focus:ring-[#7ad5dd]"
              />
            </label>

            <label className="block space-y-3">
              <span className="ml-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">แนบรูปภาพ</span>
              <span className="relative flex aspect-video w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[18px] border-2 border-dashed border-teal-200/70 bg-teal-50/30">
                <WellnessRoomVisual />
                <span className="relative z-10 flex flex-col items-center text-primary">
                  <Camera aria-hidden="true" className="mb-3 size-10" fill="#006067" />
                  <span className="text-sm font-medium">แตะเพื่ออัปโหลดรูปภาพ</span>
                </span>
                <input type="file" className="hidden" />
              </span>
            </label>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-4 ml-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">เลือกหมวดหมู่</h2>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((category, index) => (
              <button
                key={category}
                type="button"
                className={
                  index === 1
                    ? "shrink-0 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(0,96,103,0.2)]"
                    : "shrink-0 rounded-full border border-white/30 bg-white/70 px-5 py-3 text-sm font-semibold text-primary shadow-sm backdrop-blur-[10px]"
                }
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-7 text-center">
          <button
            type="button"
            className="flex h-[68px] w-full items-center justify-center gap-3 rounded-full bg-primary-gradient text-[24px] font-extrabold text-white shadow-[0_20px_40px_rgba(0,123,131,0.25)] active:scale-[0.98]"
          >
            <Send aria-hidden="true" className="size-7 fill-white" />
            โพสต์
          </button>
          <p className="mt-6 px-4 text-xs leading-5 text-[#3e494a]/60">
            การโพสต์กระทู้แสดงว่าคุณยอมรับข้อกำหนดและเงื่อนไขการใช้งานของ Clinical Ethereality
          </p>
        </section>
      </main>
    </div>
  );
}

function CreatePostHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-header bg-white/70 shadow-[0_0_40px_rgba(0,123,131,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-[104px] w-full max-w-mobile items-center justify-between px-7">
        <div className="flex min-w-0 items-center gap-5">
          <Link href="/community" aria-label="Back to community" className="flex size-10 items-center justify-center rounded-full text-primary">
            <ArrowLeft aria-hidden="true" className="size-7" strokeWidth={2.25} />
          </Link>
          <h1 className="truncate text-[24px] font-bold tracking-tight text-[#3e494a]">เขียนกระทู้ใหม่</h1>
        </div>
        <button
          type="button"
          className="h-[58px] shrink-0 rounded-full bg-primary px-8 text-[23px] font-bold text-white shadow-[0_10px_24px_rgba(0,96,103,0.2)]"
        >
          Post
        </button>
      </div>
    </header>
  );
}

function WellnessRoomVisual() {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 flex items-end justify-center overflow-hidden bg-[linear-gradient(90deg,rgba(244,237,221,0.65),rgba(255,255,255,0.4),rgba(244,237,221,0.65))] opacity-60"
    >
      <span className="absolute inset-y-0 left-4 w-16 skew-x-[-9deg] bg-white/55 blur-[1px]" />
      <span className="absolute inset-y-0 right-4 w-16 skew-x-[9deg] bg-white/55 blur-[1px]" />
      <span className="absolute bottom-9 h-8 w-40 rounded-full bg-[#d8c7a9]/50 blur-xl" />
      <span className="mb-8 h-9 w-40 rounded-[18px] bg-[#f5f0e8]" />
      <span className="absolute bottom-16 h-10 w-24 rounded bg-white/70" />
    </span>
  );
}
