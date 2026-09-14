import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/community/pinning/actions", () => ({ updateArticlePinAction: vi.fn() }));

import { CommunityPostCard } from "@/components/ui/CommunityPostCard";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { CommunitySearchResults } from "@/features/community/CommunitySearchResults";
import { AdminPinnedPostsManager } from "@/features/admin/AdminPinnedPostsManager";
import type { CommunityPostSummary } from "@/features/community/types";

function summary(overrides: Partial<CommunityPostSummary> = {}): CommunityPostSummary {
  return {
    id: "article-1",
    slug: "community-post",
    title: "คำแนะนำสุขภาพ",
    excerpt: "รายละเอียดคำแนะนำสุขภาพสำหรับสมาชิก",
    category: "ดูแลผิว",
    author: "สมาชิก 0001",
    authorRole: "customer",
    time: "เมื่อสักครู่",
    likesCount: 4,
    commentsCount: 2,
    coverImageUrl: null,
    pinned: true,
    likedByViewer: false,
    savedByViewer: false,
    ownedByViewer: false,
    ...overrides
  };
}

describe("community pinned post UI", () => {
  it("shows a Pin badge on feed cards while ordinary members never receive pin controls", () => {
    const html = renderToStaticMarkup(
      <CommunityPostCard
        articleId="article-1"
        title="คำแนะนำสุขภาพ"
        author="สมาชิก 0001"
        time="เมื่อสักครู่"
        body="เนื้อหา"
        likes="4"
        comments="2"
        portrait="ananya"
        href="/community/community-post"
        editHref="/community/community-post/edit"
        pinned
      />
    );

    expect(html).toContain("ปักหมุด");
    expect(html).toContain("แก้ไขโพสต์");
    expect(html).not.toContain("ถอนหมุดโพสต์");
    expect(html).toContain("เปิดเมนูโพสต์");
  });

  it("adds accessible Admin pin/unpin disclosure controls to feed and Search without changing Search ordering", () => {
    const feedHtml = renderToStaticMarkup(
      <CommunityPostCard
        articleId="article-1"
        author="สมาชิก 0001"
        time="เมื่อสักครู่"
        body="เนื้อหา"
        likes="4"
        comments="2"
        portrait="ananya"
        canManagePins
        pinned
      />
    );
    expect(feedHtml).toContain("<details");
    expect(feedHtml).toContain('aria-label="เปิดเมนูโพสต์"');
    expect(feedHtml).toContain("ถอนหมุดโพสต์");
    expect(feedHtml).toContain('aria-live="polite"');

    const searchHtml = renderToStaticMarkup(
      <CommunitySearchResults
        data={{
          query: "",
          category: "",
          canManagePins: true,
          results: [summary()]
        }}
      />
    );
    expect(searchHtml).toContain("ถอนหมุดโพสต์");
    expect(searchHtml).toContain("ปักหมุด");
  });

  it("shows the Pin badge on every shared ArticleCard surface", () => {
    const html = renderToStaticMarkup(
      <ArticleCard
        title="Pinned"
        eyebrow="ดูแลผิว"
        author="สมาชิก"
        likes="1"
        date="วันนี้"
        imageSrc="/images/community/vitamin-bottles.png"
        imageAlt=""
        icon="review"
        authorIcon="account"
        pinned
      />
    );
    expect(html).toContain("ปักหมุด");
  });

  it("renders the Admin manager at 3/3 with searchable published posts, unpin actions, and disabled extra pins", () => {
    const pinnedPosts = [1, 2, 3].map((index) => ({
      id: `pin-${index}`,
      slug: `pin-${index}`,
      title: `Pinned ${index}`,
      category: "ดูแลผิว",
      authorName: "สมาชิก",
      pinned: true,
      pinnedAt: "14 ก.ย. 2569 12:00"
    }));
    const html = renderToStaticMarkup(
      <AdminPinnedPostsManager
        data={{
          pinnedPosts,
          publishedPosts: [
            ...pinnedPosts,
            { id: "candidate", slug: "candidate", title: "Candidate", category: "สุขภาพทั่วไป", authorName: "สมาชิก", pinned: false, pinnedAt: null }
          ],
          maximumPins: 3
        }}
      />
    );

    expect(html).toContain("จัดการโพสต์ปักหมุด");
    expect(html).toContain("3/3 หมุด");
    expect(html).toContain("ครบ 3 หมุดแล้ว กรุณาถอนหมุดเดิมก่อน");
    expect(html).toContain("ค้นหาหัวข้อ หมวด หรือผู้เขียน");
    expect(html).toContain("ถอนหมุดโพสต์");
    expect(html).toMatch(/<button[^>]+disabled=""[^>]*aria-label="ปักหมุดโพสต์"|<button[^>]+aria-label="ปักหมุดโพสต์"[^>]+disabled=""/);
  });
});
