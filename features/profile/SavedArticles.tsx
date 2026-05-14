import Link from "next/link";
import { ArrowLeft, BookmarkCheck, Search } from "lucide-react";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { EmptyState } from "@/components/ui/EmptyState";

const savedArticles = [
  {
    title: "5 วิตามินเสริมภูมิคุ้มกันที่หมอแนะนำ",
    eyebrow: "บทความจากแพทย์",
    author: "Dr. Arisara",
    likes: "1.2k",
    date: "24 ต.ค.",
    imageSrc: "/images/community/vitamin-bottles.png",
    imageAlt: "ขวดวิตามินบนพื้นผิวคลินิกที่สะอาด",
    badge: "บันทึกแล้ว",
    icon: "verified" as const,
    authorIcon: "person" as const,
    href: "/community/vitamin-c-tips"
  },
  {
    title: "รีวิว: ทานวิตามินซี 1000mg ติดต่อกัน 1 เดือน",
    eyebrow: "ประสบการณ์สมาชิก",
    author: "K. Ananya",
    likes: "856",
    date: "22 ต.ค.",
    imageSrc: "/images/community/vitamin-review.png",
    imageAlt: "ผู้หญิงยิ้มในแสงเช้าหลังดูแลสุขภาพ",
    badge: "รีวิว",
    badgeTone: "teal" as const,
    icon: "review" as const,
    authorIcon: "account" as const
  }
];

export function SavedArticles() {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#f7f9fb] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <Header />

      <main className="mx-auto w-full max-w-mobile px-6 pt-8">
        <section className="rounded-[28px] border border-white/40 bg-white/70 p-6 shadow-[0_12px_40px_rgba(0,96,103,0.08)] backdrop-blur-[24px]">
          <div className="mb-4 flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-full bg-[#e8fbf7] text-primary">
              <BookmarkCheck aria-hidden="true" className="size-7" strokeWidth={2.25} />
            </span>
            <div>
              <h1 className="text-[24px] font-extrabold leading-7 text-primary">บทความที่บันทึกไว้</h1>
              <p className="mt-1 text-sm text-[#3e494a]">เก็บบทความสุขภาพที่ต้องการกลับมาอ่านภายหลัง</p>
            </div>
          </div>
          <Link
            href="/community/search"
            className="mt-5 flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-white shadow-[0_12px_28px_rgba(0,96,103,0.18)]"
          >
            <Search aria-hidden="true" className="size-4" />
            ค้นหาบทความเพิ่มเติม
          </Link>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-7">
          {savedArticles.length === 0 ? (
            <EmptyState
              title="ยังไม่มีบทความที่บันทึก"
              body="เมื่อกดบันทึกบทความจากชุมชน รายการจะปรากฏที่นี่"
              icon={<BookmarkCheck aria-hidden="true" className="size-5" />}
            />
          ) : (
            savedArticles.map((article) => <ArticleCard key={article.title} {...article} />)
          )}
        </section>
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-header bg-white/70 shadow-[0_0_40px_rgba(0,123,131,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-[82px] w-full max-w-mobile items-center gap-4 px-7">
        <Link href="/profile" aria-label="กลับไปหน้าโปรไฟล์" className="flex size-10 items-center justify-center rounded-full text-primary">
          <ArrowLeft aria-hidden="true" className="size-6" strokeWidth={2.4} />
        </Link>
        <div className="min-w-0">
          <p className="text-[22px] font-bold tracking-wide text-primary">บทความที่บันทึกไว้</p>
          <p className="truncate text-xs font-medium uppercase tracking-[0.14em] text-[#3e494a]/60">คลังบทความส่วนตัว</p>
        </div>
      </div>
    </header>
  );
}
