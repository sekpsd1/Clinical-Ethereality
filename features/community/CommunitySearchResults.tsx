import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Search, X } from "lucide-react";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { communityCategories } from "@/features/community/policy";
import type { CommunitySearchData } from "@/features/community/types";

export function CommunitySearchResults({ data }: { data: CommunitySearchData }) {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#f7f9fb] pb-[calc(7.75rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <SearchResultsHeader query={data.query} />

      <main className="mx-auto w-full max-w-mobile px-6 pt-[86px]">
        <section className="rounded-[32px] bg-gradient-to-br from-primary/10 to-white p-1 shadow-[0_18px_50px_rgba(0,96,103,0.05)]">
          <form
            id="community-search-form"
            method="get"
            action="/community/search"
            className="rounded-[31px] bg-white/40 p-6 backdrop-blur-[24px]"
          >
            {data.category ? <input type="hidden" name="category" value={data.category} /> : null}
            <label className="relative block">
              <input
                aria-label="Search community"
                name="q"
                className="h-16 w-full rounded-full border-0 bg-[#e6e8ea] px-6 pr-14 font-headline text-[15px] font-semibold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                defaultValue={data.query}
                placeholder="ค้นหาบทความหรือหัวข้อ"
                type="search"
              />
              {data.query ? (
                <Link
                  aria-label="Clear search"
                  href={data.category ? (`/community/search?category=${encodeURIComponent(data.category)}` as Route) : "/community/search"}
                  className="absolute right-4 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-[#3e494a]/55"
                >
                  <X aria-hidden="true" className="size-5" strokeWidth={2.1} />
                </Link>
              ) : (
                <button
                  aria-label="Search"
                  className="absolute right-4 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-primary"
                  type="submit"
                >
                  <Search aria-hidden="true" className="size-5" strokeWidth={2.1} />
                </button>
              )}
            </label>
          </form>
        </section>

        <section className="mt-9 overflow-hidden">
          <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterLink label="ทั้งหมด" query={data.query} active={!data.category} />
            {communityCategories.map((category) => (
              <FilterLink
                key={category}
                label={category}
                query={data.query}
                category={category}
                active={data.category === category}
              />
            ))}
          </div>
        </section>

        <section className="mt-5 grid grid-cols-1 gap-9">
          {data.unavailable ? (
            <EmptyState title="ยังค้นหาไม่ได้" body="กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูลแล้วลองใหม่" />
          ) : data.results.length === 0 ? (
            <EmptyState
              title={data.query || data.category ? "ไม่พบผลลัพธ์" : "ยังไม่มีบทความ"}
              body="ลองเปลี่ยนคำค้นหรือเลือกหมวดอื่น"
            />
          ) : (
            data.results.map((result, index) => (
              <ArticleCard
                key={result.id}
                title={result.title}
                eyebrow={result.category}
                author={result.author}
                likes={String(result.likesCount)}
                date={result.time}
                imageSrc={
                  index % 3 === 0
                    ? "/images/community/vitamin-bottles.png"
                    : index % 3 === 1
                      ? "/images/community/vitamin-review.png"
                      : "/images/community/morning-forest.png"
                }
                imageAlt=""
                badge={result.savedByViewer ? "บันทึกแล้ว" : result.authorRole === "customer" ? "โพสต์สมาชิก" : "ตรวจสอบแล้ว"}
                badgeTone={result.authorRole === "customer" ? "teal" : "light"}
                icon={result.authorRole === "customer" ? "review" : "verified"}
                authorIcon={result.authorRole === "customer" ? "account" : "medical"}
                href={`/community/${result.slug}`}
              />
            ))
          )}
        </section>
      </main>
    </div>
  );
}

function FilterLink({
  active,
  category,
  label,
  query
}: {
  active: boolean;
  category?: string;
  label: string;
  query: string;
}) {
  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  if (category) {
    params.set("category", category);
  }
  const href = params.size ? `/community/search?${params.toString()}` : "/community/search";

  return (
    <Link
      href={href as Route}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "shrink-0 rounded-full bg-primary px-8 py-3 text-sm font-medium text-white shadow-[0_10px_24px_rgba(0,96,103,0.2)]"
          : "shrink-0 rounded-full border border-white/40 bg-white/60 px-8 py-3 text-sm font-medium text-[#3e494a] shadow-sm backdrop-blur-[24px]"
      }
    >
      {label}
    </Link>
  );
}

function SearchResultsHeader({ query }: { query: string }) {
  return (
    <header className="fixed inset-x-0 top-0 z-header bg-white/70 shadow-[0_0_40px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-[70px] w-full max-w-mobile items-center px-7">
        <Link
          aria-label="Back to community"
          className="mr-4 flex size-10 items-center justify-center rounded-full text-primary active:scale-95"
          href="/community"
        >
          <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.25} />
        </Link>
        <h1 className="flex-1 truncate font-headline text-[20px] font-bold tracking-wide text-primary">
          {query || "ค้นหา Community"}
        </h1>
        <button
          aria-label="Search"
          form="community-search-form"
          className="flex size-10 items-center justify-center rounded-full text-primary active:scale-95"
          type="submit"
        >
          <Search aria-hidden="true" className="size-5" strokeWidth={2.25} />
        </button>
      </div>
    </header>
  );
}
