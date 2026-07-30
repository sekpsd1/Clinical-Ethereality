import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { PublicSession } from "@/lib/auth/types";
import { formatCommunityRelativeTime, getPublicCommunityAuthor } from "@/features/community/policy";
import type { CommunityArticleDetailData, CommunityCommentItem } from "@/features/community/article/types";

type ArticleRecord = NonNullable<Awaited<ReturnType<typeof getArticleBySlug>>>;

function getUnavailableCommunityArticle(
  slug: string,
  state: "missing" | "unavailable"
): CommunityArticleDetailData {
  return {
    id: "",
    slug,
    title: state === "missing" ? "ไม่พบบทความนี้" : "ยังโหลดบทความไม่ได้",
    body:
      state === "missing"
        ? "บทความอาจถูกลบ ซ่อน หรือยังไม่ได้เผยแพร่"
        : "กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง",
    author: "",
    category: "",
    coverImageUrl: null,
    likesCount: 0,
    commentsCount: 0,
    likedByViewer: false,
    savedByViewer: false,
    ownedByViewer: false,
    comments: [],
    state
  };
}

function getArticleBySlug(slug: string) {
  return prisma.article.findUnique({
    where: {
      slug
    },
    include: {
      author: {
        select: {
          id: true,
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
              id: true,
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
      },
      savedBy: {
        select: {
          userId: true
        }
      }
    }
  });
}

function mapComment(comment: ArticleRecord["comments"][number], viewerId: string): CommunityCommentItem {
  const isStaff = comment.user.role === "doctor" || comment.user.role === "pharmacist" || comment.user.role === "admin";

  return {
    id: comment.id,
    author: getPublicCommunityAuthor(comment.user),
    time: formatCommunityRelativeTime(comment.createdAt),
    body: comment.body,
    verified: isStaff,
    ownedByViewer: comment.userId === viewerId,
    avatar: isStaff ? "pharmacist" : "somchai"
  };
}

export async function getCommunityArticleDetail(slug: string, session: PublicSession): Promise<CommunityArticleDetailData> {
  noStore();

  try {
    const article = await getArticleBySlug(slug);

    if (!article) {
      return getUnavailableCommunityArticle(slug, "missing");
    }

    if (article.status !== "published") {
      return getUnavailableCommunityArticle(slug, "missing");
    }

    return {
      id: article.id,
      slug: article.slug,
      title: article.title,
      body: article.body,
      author: getPublicCommunityAuthor(article.author),
      category: article.category ?? "โรคทั่วไป",
      coverImageUrl: article.coverImageUrl,
      likesCount: article.likes.length,
      commentsCount: article.comments.length,
      likedByViewer: article.likes.some((like) => like.userId === session.userId),
      savedByViewer: article.savedBy.some((saved) => saved.userId === session.userId),
      ownedByViewer: article.authorId === session.userId,
      comments: article.comments.map((comment) => mapComment(comment, session.userId)),
      state: "ready"
    };
  } catch {
    return getUnavailableCommunityArticle(slug, "unavailable");
  }
}
