import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { maximumPinnedArticles } from "@/features/community/pinning/service";
import type { AdminPinnedPostItem, AdminPinnedPostsData } from "@/features/community/pinning/types";

function formatPinnedAt(value: Date | null): string | null {
  if (!value) return null;

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function mapPinnedPost(article: {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  pinnedAt: Date | null;
  author: { displayName: string | null };
}): AdminPinnedPostItem {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    category: article.category ?? "โรคทั่วไป",
    authorName: article.author.displayName ?? "สมาชิกชุมชน",
    pinned: Boolean(article.pinnedAt),
    pinnedAt: formatPinnedAt(article.pinnedAt)
  };
}

const pinManagerSelect = {
  id: true,
  slug: true,
  title: true,
  category: true,
  pinnedAt: true,
  author: {
    select: {
      displayName: true
    }
  }
} as const;

export async function getAdminPinnedPostsData(): Promise<AdminPinnedPostsData> {
  noStore();

  try {
    const [pinnedPosts, publishedPosts] = await Promise.all([
      prisma.article.findMany({
        where: {
          status: "published",
          pinnedAt: { not: null }
        },
        orderBy: [{ pinnedAt: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        take: maximumPinnedArticles,
        select: pinManagerSelect
      }),
      prisma.article.findMany({
        where: { status: "published" },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 100,
        select: pinManagerSelect
      })
    ]);

    return {
      pinnedPosts: pinnedPosts.map(mapPinnedPost),
      publishedPosts: publishedPosts.map(mapPinnedPost),
      maximumPins: maximumPinnedArticles
    };
  } catch {
    return {
      pinnedPosts: [],
      publishedPosts: [],
      maximumPins: maximumPinnedArticles,
      unavailable: true
    };
  }
}
