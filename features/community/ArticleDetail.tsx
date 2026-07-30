import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Bookmark, CheckCircle2, Flag, Heart, MessageSquare, Pencil } from "lucide-react";
import { CommentComposer } from "@/components/ui/CommentComposer";
import { ShareButton } from "@/components/ui/ShareButton";
import {
  createArticleCommentAction,
  reportContentAction,
  toggleArticleLikeAction,
  toggleSavedArticleAction
} from "@/features/community/article/actions";
import { communityReportReasons } from "@/features/community/policy";
import type { CommunityArticleDetailData, CommunityCommentItem } from "@/features/community/article/types";

export function ArticleDetail({
  article,
  feedback
}: {
  article: CommunityArticleDetailData;
  feedback?: {
    comment?: string;
    reported?: string;
  };
}) {
  const ready = article.state === "ready";

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[linear-gradient(180deg,#f7f9fb_0%,#eef3f4_100%)] pb-[calc(12rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <ArticleHeader title={ready ? article.category : "Community"} />

      <main className="mx-auto w-full max-w-mobile px-5 pt-[88px]">
        {feedback?.reported ? <FeedbackBanner type="reported" value={feedback.reported} /> : null}
        {feedback?.comment === "rate-limited" ? <FeedbackBanner type="comment" value={feedback.comment} /> : null}

        {!ready ? (
          <section className="mt-6 rounded-[24px] border border-white/40 bg-white/70 p-7 text-center shadow-lg backdrop-blur-[24px]">
            <h1 className="text-xl font-extrabold text-primary">{article.title}</h1>
            <p className="mt-3 text-sm leading-6 text-[#3e494a]">{article.body}</p>
            <Link href="/community" className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-bold text-white">
              กลับหน้าชุมชน
            </Link>
          </section>
        ) : (
          <>
            <section className="relative z-0 mb-[-40px] mt-4">
              <div className="aspect-video w-full overflow-hidden rounded-[24px] shadow-xl">
                <OrangeHero />
              </div>
            </section>

            <article className="relative z-10 mb-6 rounded-[24px] border border-white/30 bg-white/70 p-6 shadow-lg backdrop-blur-[24px]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">{article.category}</span>
                {article.ownedByViewer ? (
                  <Link
                    href={`/community/${article.slug}/edit` as Route}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-2 text-xs font-bold text-primary"
                  >
                    <Pencil aria-hidden="true" className="size-3.5" />
                    แก้ไขโพสต์
                  </Link>
                ) : null}
              </div>
              <h1 className="mb-3 text-[26px] font-extrabold leading-[1.18] text-primary">{article.title}</h1>
              <p className="mb-6 text-xs font-semibold text-[#6e797a]">โดย {article.author}</p>
              <p className="mb-7 whitespace-pre-wrap text-[17px] leading-8 text-[#3e494a]">{article.body}</p>
              <div className="flex items-center gap-5 text-base font-semibold tracking-wide text-[#6e797a]">
                <span>{article.likesCount} ไลก์</span>
                <span>{article.commentsCount} ความคิดเห็น</span>
              </div>
              {!article.ownedByViewer ? (
                <ReportContentForm
                  articleSlug={article.slug}
                  itemId={article.id}
                  itemType="article"
                  label="รายงานบทความ"
                />
              ) : null}
            </article>

            <section className="mb-10 grid grid-cols-4 items-center rounded-full border border-white/30 bg-white/70 p-2 shadow-sm backdrop-blur-[24px]">
              <form action={toggleArticleLikeAction} className="flex">
                <input type="hidden" name="articleId" value={article.id} />
                <button type="submit" className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-primary">
                  <Heart aria-hidden="true" className="size-5" fill={article.likedByViewer ? "#006067" : "none"} />
                  <span className="text-[10px] font-bold">ถูกใจ</span>
                </button>
              </form>
              <Link href="#comments" className="flex flex-col items-center justify-center gap-1 py-2 text-[#3e494a]">
                <MessageSquare aria-hidden="true" className="size-5 fill-[#3e494a]" />
                <span className="text-[10px] font-bold">ตอบกลับ</span>
              </Link>
              <form action={toggleSavedArticleAction} className="flex">
                <input type="hidden" name="articleId" value={article.id} />
                <button type="submit" className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[#3e494a]">
                  <Bookmark aria-hidden="true" className="size-5" fill={article.savedByViewer ? "#006067" : "none"} />
                  <span className="text-[10px] font-bold">{article.savedByViewer ? "บันทึกแล้ว" : "บันทึก"}</span>
                </button>
              </form>
              <span className="flex flex-col items-center justify-center gap-1 py-2 text-[#3e494a]">
                <ShareButton href={`/community/${article.slug}`} label="แชร์บทความ" className="text-[#3e494a]" />
                <span className="text-[10px] font-bold">แชร์</span>
              </span>
            </section>

            <section id="comments" className="scroll-mt-24 space-y-6">
              <h2 className="px-2 text-base font-bold text-[#3e494a]">ความคิดเห็นล่าสุด</h2>
              {article.comments.length === 0 ? (
                <p className="rounded-[24px] border border-white/30 bg-white/70 p-4 text-sm leading-6 text-[#3e494a] shadow-sm backdrop-blur-[24px]">
                  ยังไม่มีความคิดเห็น
                </p>
              ) : null}
              {article.comments.map((comment) => (
                <CommentItem key={comment.id} articleSlug={article.slug} comment={comment} />
              ))}
            </section>
          </>
        )}
      </main>

      {ready ? (
        <div className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[45] px-5">
          <CommentComposer
            action={createArticleCommentAction}
            hiddenFields={[{ name: "articleId", value: article.id }]}
            label="Article comment"
            placeholder="แสดงความคิดเห็นโดยไม่เปิดเผยข้อมูลส่วนตัว..."
          />
        </div>
      ) : null}
    </div>
  );
}

function FeedbackBanner({ type, value }: { type: "comment" | "reported"; value: string }) {
  const message =
    type === "comment"
      ? "ส่งความคิดเห็นถี่เกินไป กรุณารออย่างน้อยหนึ่งนาที"
      : value === "success"
        ? "ส่งรายงานแล้ว เนื้อหาจะยังแสดงอยู่จนกว่าผู้ดูแลจะตรวจสอบ"
        : value === "duplicate"
          ? "คุณเคยรายงานเนื้อหานี้แล้ว"
          : value === "self"
            ? "ไม่สามารถรายงานเนื้อหาของตนเองได้"
            : "ยังส่งรายงานไม่ได้ กรุณาลองใหม่";

  return (
    <p className="mt-4 rounded-[18px] border border-primary/15 bg-white/75 px-4 py-3 text-sm font-semibold text-primary">
      {message}
    </p>
  );
}

function ArticleHeader({ title }: { title: string }) {
  return (
    <header className="fixed inset-x-0 top-0 z-header bg-white/70 shadow-[0_40px_40px_-15px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-16 w-full max-w-mobile items-center gap-4 px-7">
        <Link href="/community" aria-label="Back to community" className="text-primary">
          <ArrowLeft aria-hidden="true" className="size-6" strokeWidth={2.4} />
        </Link>
        <h1 className="truncate text-[21px] font-bold tracking-tight text-primary">{title}</h1>
      </div>
    </header>
  );
}

function CommentItem({
  articleSlug,
  comment
}: {
  articleSlug: string;
  comment: CommunityCommentItem;
}) {
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
        <p className="whitespace-pre-wrap text-sm leading-6 text-[#3e494a]">{comment.body}</p>
        {!comment.ownedByViewer ? (
          <ReportContentForm
            articleSlug={articleSlug}
            itemId={comment.id}
            itemType="comment"
            label="รายงานความคิดเห็น"
            compact
          />
        ) : null}
      </div>
    </div>
  );
}

function ReportContentForm({
  articleSlug,
  compact,
  itemId,
  itemType,
  label
}: {
  articleSlug: string;
  compact?: boolean;
  itemId: string;
  itemType: "article" | "comment";
  label: string;
}) {
  return (
    <form action={reportContentAction} className={compact ? "mt-3 flex flex-wrap items-center gap-2" : "mt-5 flex flex-wrap items-center gap-2"}>
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="itemType" value={itemType} />
      <input type="hidden" name="articleSlug" value={articleSlug} />
      <label className="sr-only" htmlFor={`reason-${itemType}-${itemId}`}>
        เหตุผลที่รายงาน
      </label>
      <select
        id={`reason-${itemType}-${itemId}`}
        name="reason"
        defaultValue="privacy"
        className="min-w-0 flex-1 rounded-full border border-[#bdc9ca]/40 bg-[#f7f9fb] px-3 py-2 text-[11px] font-semibold text-[#3e494a]"
      >
        {communityReportReasons.map((reason) => (
          <option key={reason.value} value={reason.value}>
            {reason.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-full bg-[#f7f9fb] px-3 py-2 text-[11px] font-bold text-[#93000a]"
      >
        <Flag aria-hidden="true" className="size-3.5" />
        {label}
      </button>
    </form>
  );
}

function OrangeHero() {
  return (
    <div
      role="img"
      aria-label="Community article cover"
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
