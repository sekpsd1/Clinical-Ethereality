import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { PenLine, Search } from "lucide-react";
import { CommunityPostCard } from "@/components/ui/CommunityPostCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { communityCategories } from "@/features/community/policy";
import type { CommunityHubData } from "@/features/community/types";

export function CommunityHub({
  data,
  reported
}: {
  data: CommunityHubData;
  reported?: string;
}) {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[linear-gradient(180deg,#e0f2f1_0%,#f7f9fb_100%)] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <CommunityHeader />

      <main className="mx-auto w-full max-w-mobile">
        {reported ? (
          <p className="mx-7 mt-5 rounded-[18px] border border-primary/15 bg-white/70 px-4 py-3 text-sm font-semibold text-primary">
            รับรายงานแล้ว เนื้อหาจะยังแสดงอยู่จนกว่าผู้ดูแลจะตรวจสอบ
          </p>
        ) : null}

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

        {data.featured ? (
          <section className="mt-8 px-7">
            <Link href={`/community/${data.featured.slug}` as Route}>
              <article className="overflow-hidden rounded-[24px] border border-white/20 bg-white/70 shadow-[0_0_40px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
                <div className="aspect-[16/10] w-full overflow-hidden bg-[linear-gradient(135deg,#53cfc2_0%,#0a9287_100%)]">
                  {data.featured.coverImageUrl ? (
                    <div className="relative h-full w-full">
                      <Image
                        src={data.featured.coverImageUrl}
                        alt=""
                        fill
                        unoptimized
                        sizes="(max-width: 430px) calc(100vw - 56px), 374px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <DoctorIllustration />
                  )}
                </div>
                <div className="p-6">
                  <span className="mb-4 inline-flex rounded-full bg-primary/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                    {data.featured.authorRole === "customer" ? "Community Post" : "Verified Content"}
                  </span>
                  <h1 className="mb-4 text-[21px] font-extrabold leading-8 text-[#191c1e]">
                    {data.featured.title}
                  </h1>
                  <div className="flex items-center gap-3">
                    <span className="size-7 overflow-hidden rounded-full bg-slate-200">
                      <MiniDoctorPortrait />
                    </span>
                    <p className="text-sm font-medium text-[#3e494a]">By {data.featured.author}</p>
                  </div>
                </div>
              </article>
            </Link>
          </section>
        ) : null}

        <section className="mt-10 overflow-hidden">
          <div className="flex gap-4 overflow-x-auto px-7 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link
              href="/community"
              aria-current={!data.selectedCategory ? "page" : undefined}
              className={
                !data.selectedCategory
                  ? "shrink-0 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm"
                  : "shrink-0 rounded-full border border-white/40 bg-white/80 px-6 py-3 text-sm font-semibold text-primary shadow-sm backdrop-blur-[24px]"
              }
            >
              ทั้งหมด
            </Link>
            {communityCategories.map((category) => (
              <Link
                key={category}
                href={`/community?category=${encodeURIComponent(category)}` as Route}
                aria-current={data.selectedCategory === category ? "page" : undefined}
                className={
                  data.selectedCategory === category
                    ? "shrink-0 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm"
                    : "shrink-0 rounded-full border border-white/40 bg-white/80 px-6 py-3 text-sm font-semibold text-primary shadow-sm backdrop-blur-[24px]"
                }
              >
                {category}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-6 space-y-6 px-7">
          <h2 className="px-1 text-[24px] font-extrabold leading-8 text-[#191c1e]">Community Feed</h2>
          {data.unavailable ? (
            <EmptyState title="ยังโหลด Community ไม่ได้" body="กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูลแล้วลองใหม่" />
          ) : data.posts.length === 0 ? (
            <EmptyState
              title="ยังไม่มีโพสต์ในหมวดนี้"
              body="เริ่มแบ่งปันข้อมูลทั่วไปโดยไม่ระบุข้อมูลส่วนตัวหรือข้อมูลสุขภาพของบุคคล"
            />
          ) : (
            data.posts.map((post) => (
              <CommunityPostCard
                key={post.id}
                title={post.title}
                author={post.author}
                time={post.time}
                body={post.excerpt}
                likes={String(post.likesCount)}
                comments={String(post.commentsCount)}
                liked={post.likedByViewer}
                portrait={post.authorRole === "customer" ? "ananya" : "somchai"}
                href={`/community/${post.slug}`}
                editHref={post.ownedByViewer ? `/community/${post.slug}/edit` : undefined}
                imageSrc={post.coverImageUrl}
              />
            ))
          )}
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
      aria-label="Clinical community feature"
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
