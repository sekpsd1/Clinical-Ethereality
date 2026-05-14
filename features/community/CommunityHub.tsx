import Link from "next/link";
import { PenLine, Search } from "lucide-react";
import { CommunityPostCard } from "@/components/ui/CommunityPostCard";

type Category = {
  label: string;
};

type FeedPost = {
  author: string;
  time: string;
  body: string;
  likes: string;
  comments: string;
  liked?: boolean;
  portrait: "ananya" | "somchai";
  href?: "/community/vitamin-c-tips";
};

const categories: Category[] = [
  { label: "โรคทั่วไป" },
  { label: "วิตามิน & อาหารเสริม" },
  { label: "การดูแลผิว" },
  { label: "ปรึกษาหมอ" }
];

const feedPosts: FeedPost[] = [
  {
    author: "K. Ananya",
    time: "2 hours ago",
    body: "แชร์เคล็ดลับการทานวิตามินซีให้ได้ผลดีที่สุด แนะนำให้ทานพร้อมมื้ออาหารเช้าเพื่อการดูดซึมที่ดียิ่งขึ้นนะคะทุกคน 🍊✨",
    likes: "342",
    comments: "56",
    liked: true,
    portrait: "ananya",
    href: "/community/vitamin-c-tips"
  },
  {
    author: "K. Somchai",
    time: "5 hours ago",
    body: "เพิ่งลองปรึกษาคุณหมอผ่านแอปนี้ครั้งแรก สะดวกมากครับ ไม่ต้องรอนานเลย แนะนำสำหรับคนงานยุ่งครับ 👍",
    likes: "128",
    comments: "12",
    portrait: "somchai"
  }
];

export function CommunityHub() {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[linear-gradient(180deg,#e0f2f1_0%,#f7f9fb_100%)] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <CommunityHeader />

      <main className="mx-auto w-full max-w-mobile">
        <section className="px-7 pt-5">
          <Link href="/community/search" className="relative block">
            <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-primary/60">
              <Search aria-hidden="true" className="size-6" strokeWidth={2.25} />
            </span>
            <span className="flex h-16 items-center rounded-full bg-white/70 pl-16 pr-6 text-sm text-slate-400 shadow-sm backdrop-blur-[24px]">
              ค้นหาบทความหรือหัวข้อสุขภาพ
            </span>
          </Link>
        </section>

        <section className="mt-8 px-7">
          <article className="overflow-hidden rounded-[24px] border border-white/20 bg-white/70 shadow-[0_0_40px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
            <div className="aspect-[16/10] w-full overflow-hidden bg-[linear-gradient(135deg,#53cfc2_0%,#0a9287_100%)]">
              <DoctorIllustration />
            </div>
            <div className="p-6">
              <span className="mb-4 inline-flex rounded-full bg-primary/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                Verified Content
              </span>
              <h1 className="mb-4 text-[21px] font-extrabold leading-8 text-[#191c1e]">
                5 วิธีดูแลตัวเองเมื่อเป็นภูมิแพ้อากาศ
              </h1>
              <div className="flex items-center gap-3">
                <span className="size-7 overflow-hidden rounded-full bg-slate-200">
                  <MiniDoctorPortrait />
                </span>
                <p className="text-sm font-medium text-[#3e494a]">By Dr. Arisara</p>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-10 overflow-hidden">
          <div className="flex gap-4 overflow-x-auto px-7 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((category) => (
              <button
                key={category.label}
                type="button"
                className="shrink-0 rounded-full border border-white/40 bg-white/80 px-6 py-3 text-sm font-semibold text-primary shadow-sm backdrop-blur-[24px]"
              >
                {category.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 space-y-6 px-7">
          <h2 className="px-1 text-[24px] font-extrabold leading-8 text-[#191c1e]">Community Feed</h2>
          {feedPosts.map((post) => (
            <CommunityPostCard key={post.author} {...post} />
          ))}
        </section>
      </main>
    </div>
  );
}

function CommunityHeader() {
  return (
    <header className="sticky top-0 z-header bg-white/70 shadow-[0_0_40px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-[97px] w-full max-w-mobile items-center justify-between px-7">
        <h1 className="text-[31px] font-extrabold tracking-wide text-primary">Community</h1>
        <div className="flex items-center gap-1">
          <Link href="/community/create" aria-label="Create post" className="rounded-full p-2 text-primary">
            <PenLine aria-hidden="true" className="size-6" strokeWidth={2.25} />
          </Link>
          <Link href="/community/search" aria-label="Search community" className="rounded-full p-2 text-slate-500">
            <Search aria-hidden="true" className="size-7" strokeWidth={2.25} />
          </Link>
        </div>
      </div>
    </header>
  );
}

function DoctorIllustration() {
  return (
    <div
      role="img"
      aria-label="Female doctor in lab coat"
      className="relative flex h-full w-full items-end justify-center overflow-hidden"
    >
      <div className="absolute bottom-0 h-[76%] w-[46%] rounded-t-[48px] bg-white shadow-[0_12px_35px_rgba(0,0,0,0.1)]" />
      <div className="absolute bottom-[34%] h-[26%] w-[24%] rounded-full bg-[#f0b58a]" />
      <div className="absolute bottom-[51%] h-[28%] w-[29%] rounded-t-full bg-[#6b3428]" />
      <div className="absolute bottom-[41%] h-[4px] w-[15%] rounded-full bg-[#b84f4b]" />
      <div className="absolute bottom-[16%] h-[40%] w-[7px] rounded-full bg-[#344657]" />
      <div className="absolute bottom-[9%] h-[10%] w-[34%] rounded-t-[24px] bg-[#37b6b3]" />
      <div className="absolute bottom-[4%] right-[30%] h-[12%] w-[18%] rounded bg-[#d7eef0]" />
    </div>
  );
}

function MiniDoctorPortrait() {
  return (
    <div className="relative h-full w-full bg-[#d7f6f2]">
      <div className="absolute left-[30%] top-[16%] size-[42%] rounded-full bg-[#e5b18a]" />
      <div className="absolute left-[26%] top-[12%] h-[34%] w-[50%] rounded-t-full bg-[#704035]" />
      <div className="absolute bottom-0 left-[18%] h-[34%] w-[64%] rounded-t bg-white" />
    </div>
  );
}
