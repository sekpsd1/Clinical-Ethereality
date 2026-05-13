import Link from "next/link";
import { ArrowLeft, CheckCircle2, Flag, Heart, MessageSquare, Send, Share2 } from "lucide-react";
import { createArticleCommentAction, reportArticleAction, reportCommentAction, toggleArticleLikeAction } from "@/features/community/article/actions";
import type { CommunityArticleDetailData, CommunityCommentItem } from "@/features/community/article/types";

export function ArticleDetail({ article }: { article: CommunityArticleDetailData }) {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[linear-gradient(180deg,#f7f9fb_0%,#eef3f4_100%)] pb-[calc(12rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <ArticleHeader />

      <main className="mx-auto w-full max-w-mobile px-5 pt-[88px]">
        <section className="relative z-0 mb-[-40px] mt-4">
          <div className="aspect-video w-full overflow-hidden rounded-[24px] shadow-xl">
            <OrangeHero />
          </div>
        </section>

        <article className="relative z-10 mb-6 rounded-[24px] border border-white/30 bg-white/70 p-6 shadow-lg backdrop-blur-[24px]">
          <h1 className="mb-5 text-[26px] font-extrabold leading-[1.18] text-primary">{article.title}</h1>
          <p className="mb-7 text-[17px] leading-8 text-[#3e494a]">{article.body}</p>
          <div className="flex items-center gap-5 text-base font-semibold tracking-wide text-[#6e797a]">
            <span>{article.likesCount} ไลก์</span>
            <span>{article.commentsCount} ความคิดเห็น</span>
          </div>
          <form action={reportArticleAction} className="mt-5">
            <input type="hidden" name="itemId" value={article.id} />
            <input type="hidden" name="reason" value="Reported from article detail screen" />
            <button
              type="submit"
              disabled={article.unavailable}
              className="inline-flex items-center gap-2 rounded-full bg-[#f7f9fb] px-4 py-2 text-xs font-bold text-[#93000a] disabled:text-[#6e797a]"
            >
              <Flag aria-hidden="true" className="size-4" />
              รายงานบทความ
            </button>
          </form>
        </article>

        <section className="mb-10 flex items-center rounded-full border border-white/30 bg-white/70 p-2 shadow-sm backdrop-blur-[24px]">
          <form action={toggleArticleLikeAction} className="flex flex-1">
            <input type="hidden" name="articleId" value={article.id} />
            <button
              type="submit"
              disabled={article.unavailable}
              className="flex flex-1 items-center justify-center gap-2 py-2 text-primary disabled:text-[#6e797a]"
            >
              <Heart aria-hidden="true" className="size-6" fill={article.likedByViewer ? "#006067" : "none"} />
              <span className="text-sm font-bold">ถูกใจ</span>
            </button>
          </form>
          <span className="h-5 w-px bg-[#bdc9ca]/30" />
          <button type="button" className="flex flex-1 items-center justify-center gap-2 py-2 text-[#3e494a]">
            <MessageSquare aria-hidden="true" className="size-6 fill-[#3e494a]" />
            <span className="text-sm font-bold">ตอบกลับ</span>
          </button>
          <span className="h-5 w-px bg-[#bdc9ca]/30" />
          <button type="button" className="flex flex-1 items-center justify-center gap-2 py-2 text-[#3e494a]">
            <Share2 aria-hidden="true" className="size-6" />
            <span className="text-sm font-bold">แชร์</span>
          </button>
        </section>

        <section className="space-y-6">
          <h2 className="px-2 text-base font-bold text-[#3e494a]">ความคิดเห็นล่าสุด</h2>
          {article.comments.length === 0 ? (
            <p className="rounded-[24px] border border-white/30 bg-white/70 p-4 text-sm leading-6 text-[#3e494a] shadow-sm backdrop-blur-[24px]">
              ยังไม่มีความคิดเห็น
            </p>
          ) : null}
          {article.comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[45] px-5">
        <form
          action={createArticleCommentAction}
          className="mx-auto flex h-16 w-full max-w-mobile items-center rounded-full border border-white/50 bg-white/70 p-2 shadow-2xl backdrop-blur-[24px]"
        >
          <input type="hidden" name="articleId" value={article.id} />
          <input
            type="text"
            name="body"
            placeholder="แสดงความคิดเห็นของคุณ..."
            className="min-w-0 flex-1 border-0 bg-transparent px-4 text-sm outline-none placeholder:text-[#6e797a] focus:ring-0"
          />
          <button
            type="submit"
            disabled={article.unavailable}
            aria-label="Send comment"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg disabled:bg-[#6e797a]"
          >
            <Send aria-hidden="true" className="size-6 fill-white" />
          </button>
        </form>
      </div>
    </div>
  );
}

function ArticleHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-header bg-white/70 shadow-[0_40px_40px_-15px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-16 w-full max-w-mobile items-center gap-4 px-7">
        <Link href="/community" aria-label="Back to community" className="text-primary">
          <ArrowLeft aria-hidden="true" className="size-6" strokeWidth={2.4} />
        </Link>
        <h1 className="truncate text-[21px] font-bold tracking-tight text-primary">วิตามินซี</h1>
      </div>
    </header>
  );
}

function CommentItem({ comment }: { comment: CommunityCommentItem }) {
  return (
    <div className="flex gap-4">
      <span className={`size-10 shrink-0 overflow-hidden rounded-full shadow-sm ring-2 ${comment.verified ? "ring-[#96f1fa]" : "ring-white"}`}>
        <CommentAvatar variant={comment.avatar} />
      </span>
      <div className={`flex-1 rounded-[24px] border bg-white/70 p-4 shadow-sm backdrop-blur-[24px] ${comment.verified ? "border-teal-100/70" : "border-white/30"}`}>
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1">
            <span className={comment.verified ? "truncate text-sm font-bold text-primary" : "truncate text-sm font-bold text-[#191c1e]"}>
              {comment.author}
            </span>
            {comment.verified ? <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 fill-primary text-white" /> : null}
          </div>
          <span className="shrink-0 text-[10px] text-[#6e797a]">{comment.time}</span>
        </div>
        <p className="text-sm leading-6 text-[#3e494a]">{comment.body}</p>
        <form action={reportCommentAction} className="mt-3">
          <input type="hidden" name="itemId" value={comment.id} />
          <input type="hidden" name="reason" value="Reported from article comment list" />
          <button type="submit" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#93000a]">
            <Flag aria-hidden="true" className="size-3.5" />
            รายงาน
          </button>
        </form>
      </div>
    </div>
  );
}

function OrangeHero() {
  return (
    <div
      role="img"
      aria-label="Fresh orange slices and vitamin C tablets"
      className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_70%_34%,#ffdb79_0%,#f68b12_34%,#e86c0d_64%,#f7b536_100%)]"
    >
      <div className="absolute -left-10 top-1/2 size-52 -translate-y-1/2 rounded-full border-[16px] border-[#ffd66c] bg-[#f58a13] blur-[1px]" />
      <div className="absolute -right-2 top-3 size-56 rounded-full border-[18px] border-[#ffd66c] bg-[#ff9d16] blur-[1px]" />
      <div className="absolute bottom-8 left-24 h-10 w-28 rounded-full bg-white/85 blur-sm" />
      <div className="absolute bottom-10 left-36 h-8 w-20 rounded-full bg-white shadow" />
    </div>
  );
}

function CommentAvatar({ variant }: { variant: "somchai" | "pharmacist" }) {
  if (variant === "pharmacist") {
    return (
      <div className="relative h-full w-full bg-[#d7f6f2]">
        <div className="absolute left-[30%] top-[16%] size-[42%] rounded-full bg-[#e5b18a]" />
        <div className="absolute left-[26%] top-[12%] h-[34%] w-[50%] rounded-t-full bg-[#704035]" />
        <div className="absolute bottom-0 left-[18%] h-[34%] w-[64%] rounded-t bg-white" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-[#dfe8f0]">
      <div className="absolute left-[29%] top-[18%] size-[43%] rounded-full bg-[#c08c68]" />
      <div className="absolute left-[24%] top-[12%] h-[26%] w-[52%] rounded-t-full bg-[#1f2937]" />
      <div className="absolute bottom-0 left-[20%] h-[38%] w-[60%] rounded-t bg-[#243447]" />
    </div>
  );
}
