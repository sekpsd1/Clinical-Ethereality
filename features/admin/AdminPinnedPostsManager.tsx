"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronDown, Pin, Search } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ArticlePinActionForm } from "@/features/community/pinning/ArticlePinControls";
import type { AdminPinnedPostItem, AdminPinnedPostsData } from "@/features/community/pinning/types";

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase("th-TH");
}

export function AdminPinnedPostsManager({ data }: { data: AdminPinnedPostsData }) {
  const [query, setQuery] = useState("");
  const slotsRemaining = Math.max(0, data.maximumPins - data.pinnedPosts.length);
  const isFull = slotsRemaining === 0;
  const availablePosts = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    return data.publishedPosts
      .filter((post) => !post.pinned)
      .filter((post) => {
        if (!normalizedQuery) return true;
        return normalizeSearch(`${post.title} ${post.category} ${post.authorName}`).includes(normalizedQuery);
      })
      .slice(0, 20);
  }, [data.publishedPosts, query]);

  return (
    <details className="group rounded-[8px] border border-border bg-white/85 shadow-payment-card" open>
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
          <Pin aria-hidden="true" className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-text">จัดการโพสต์ปักหมุด</span>
          <span className="block text-[11px] font-semibold text-muted">ปักล่าสุดขึ้นก่อน · สูงสุด {data.maximumPins} โพสต์ทั่วระบบ</span>
        </span>
        <StatusBadge tone={isFull ? "warning" : "success"}>{data.pinnedPosts.length}/{data.maximumPins} หมุด</StatusBadge>
        <ChevronDown aria-hidden="true" className="size-4 text-muted transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-4 border-t border-border/70 p-4">
        {data.unavailable ? (
          <p className="rounded-[8px] bg-danger/10 px-3 py-3 text-xs font-bold text-danger" role="status">
            ยังโหลดรายการโพสต์ปักหมุดไม่ได้
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-text">หมุดปัจจุบัน</h3>
              <p className={isFull ? "text-xs font-bold text-warning" : "text-xs font-semibold text-muted"} aria-live="polite">
                {isFull ? "ครบ 3 หมุดแล้ว กรุณาถอนหมุดเดิมก่อน" : `เหลือ ${slotsRemaining} ช่อง`}
              </p>
            </div>

            {data.pinnedPosts.length === 0 ? (
              <p className="rounded-[8px] bg-surface px-3 py-4 text-center text-xs font-semibold text-muted">ยังไม่มีโพสต์ปักหมุด</p>
            ) : (
              <div className="divide-y divide-border/70 rounded-[8px] border border-border bg-white">
                {data.pinnedPosts.map((post) => (
                  <PinnedPostRow key={post.id} post={post} />
                ))}
              </div>
            )}

            <section aria-label="ค้นหาโพสต์ที่เผยแพร่เพื่อปักหมุด">
              <label className="relative block">
                <span className="sr-only">ค้นหาโพสต์ที่เผยแพร่</span>
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-muted" />
                <input
                  type="search"
                  className="h-10 w-full rounded-[8px] border border-border bg-white pl-9 pr-3 text-sm font-semibold text-text outline-none focus:border-primary"
                  placeholder="ค้นหาหัวข้อ หมวด หรือผู้เขียน"
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                />
              </label>

              <div className="mt-2 max-h-72 divide-y divide-border/70 overflow-y-auto rounded-[8px] border border-border bg-white">
                {availablePosts.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs font-semibold text-muted">ไม่พบโพสต์ที่เผยแพร่และยังไม่ได้ปักหมุด</p>
                ) : (
                  availablePosts.map((post) => (
                    <div key={post.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <Link href={`/community/${post.slug}` as Route} className="line-clamp-1 text-sm font-bold text-text hover:text-primary">
                          {post.title}
                        </Link>
                        <p className="mt-1 truncate text-[11px] font-semibold text-muted">{post.category} · {post.authorName}</p>
                      </div>
                      <ArticlePinActionForm articleId={post.id} action="pin" disabled={isFull} />
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </details>
  );
}

function PinnedPostRow({ post }: { post: AdminPinnedPostItem }) {
  return (
    <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Pin aria-hidden="true" className="size-3.5 shrink-0 fill-primary text-primary" />
          <Link href={`/community/${post.slug}` as Route} className="line-clamp-1 text-sm font-bold text-text hover:text-primary">
            {post.title}
          </Link>
        </div>
        <p className="mt-1 truncate text-[11px] font-semibold text-muted">
          {post.category} · {post.authorName}{post.pinnedAt ? ` · ปักเมื่อ ${post.pinnedAt}` : ""}
        </p>
      </div>
      <ArticlePinActionForm articleId={post.id} action="unpin" />
    </div>
  );
}
