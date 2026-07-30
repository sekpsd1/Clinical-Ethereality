import Link from "next/link";
import { ArrowLeft, BookmarkCheck, Search } from "lucide-react";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { SavedCommunityArticlesData } from "@/features/community/types";

export function SavedArticles({ data }: { data: SavedCommunityArticlesData }) {
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
              <p className="mt-1 text-sm text-[#3e494a]">รายการส่วนตัวของบัญชีที่กำลังใช้งาน</p>
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
          {data.unavailable ? (
            <EmptyState
              title="ยังโหลดบทความที่บันทึกไม่ได้"
              body="กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูลแล้วลองใหม่"
              icon={<BookmarkCheck aria-hidden="true" className="size-5" />}
            />
          ) : data.articles.length === 0 ? (
            <EmptyState
              title="ยังไม่มีบทความที่บันทึก"
              body="กดบันทึกจากหน้ารายละเอียดบทความ แล้วรายการจะปรากฏเฉพาะในบัญชีของคุณ"
              icon={<BookmarkCheck aria-hidden="true" className="size-5" />}
            />
          ) : (
            data.articles.map((article, index) => (
              <ArticleCard
                key={article.id}
                title={article.title}
                eyebrow={article.category}
                author={article.author}
                likes={String(article.likesCount)}
                date={article.time}
                imageSrc={
                  index % 3 === 0
                    ? "/images/community/vitamin-bottles.png"
                    : index % 3 === 1
                      ? "/images/community/vitamin-review.png"
                      : "/images/community/morning-forest.png"
                }
                imageAlt=""
                badge="บันทึกแล้ว"
                icon={article.authorRole === "customer" ? "review" : "verified"}
                authorIcon={article.authorRole === "customer" ? "account" : "medical"}
                href={`/community/${article.slug}`}
              />
            ))
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
        <Link href="/community" aria-label="กลับไปหน้าชุมชน" className="flex size-10 items-center justify-center rounded-full text-primary">
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
