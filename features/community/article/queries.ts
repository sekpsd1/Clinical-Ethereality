import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import type { PublicSession } from "@/lib/auth/types";
import type { CommunityArticleDetailData, CommunityCommentItem } from "@/features/community/article/types";

type ArticleRecord = NonNullable<Awaited<ReturnType<typeof getArticleBySlug>>>;

function getArticleBySlug(slug: string) {
  return prisma.article.findUnique({
    where: {
      slug
    },
    include: {
      author: {
        select: {
          displayName: true,
          role: true
        }
      },
      comments: {
        where: {
          status: "visible"
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 25,
        include: {
          user: {
            select: {
              displayName: true,
              role: true
            }
          }
        }
      },
      likes: {
        select: {
          userId: true
        }
      }
    }
  });
}

function formatRelativeTime(date: Date): string {
  const deltaSeconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  const formatter = new Intl.RelativeTimeFormat("th-TH", {
    numeric: "auto"
  });

  if (deltaSeconds < 60) {
    return formatter.format(-deltaSeconds, "second");
  }

  const deltaMinutes = Math.round(deltaSeconds / 60);
  if (deltaMinutes < 60) {
    return formatter.format(-deltaMinutes, "minute");
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return formatter.format(-deltaHours, "hour");
  }

  return formatter.format(-Math.round(deltaHours / 24), "day");
}

function mapComment(comment: ArticleRecord["comments"][number]): CommunityCommentItem {
  const isStaff = comment.user.role === "doctor" || comment.user.role === "pharmacist" || comment.user.role === "admin";

  return {
    id: comment.id,
    author: comment.user.displayName ?? "LINE user",
    time: formatRelativeTime(comment.createdAt),
    body: comment.body,
    verified: isStaff,
    avatar: isStaff ? "pharmacist" : "somchai"
  };
}

export async function getCommunityArticleDetail(slug: string, session: PublicSession): Promise<CommunityArticleDetailData> {
  noStore();

  try {
    const article = await getArticleBySlug(slug);

    if (!article || article.status !== "published") {
      notFound();
    }

    return {
      id: article.id,
      title: article.title,
      body: article.body,
      author: article.author.displayName ?? "Clinical Ethereality",
      likesCount: article.likes.length,
      commentsCount: article.comments.length,
      likedByViewer: article.likes.some((like) => like.userId === session.userId),
      comments: article.comments.map(mapComment)
    };
  } catch (error) {
    if ((error as Error & { digest?: string }).digest?.startsWith("NEXT_HTTP_ERROR_FALLBACK;404")) {
      throw error;
    }

    return {
      id: "",
      title: "แชร์เคล็ดลับการทานวิตามินซีให้ได้ผลดีที่สุด",
      body: "ไม่สามารถโหลดข้อมูลบทความจากฐานข้อมูลได้ในขณะนี้",
      author: "Clinical Ethereality",
      likesCount: 0,
      commentsCount: 0,
      likedByViewer: false,
      comments: [],
      unavailable: true
    };
  }
}
