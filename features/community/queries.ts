import { unstable_noStore as noStore } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { PublicSession } from "@/lib/auth/types";
import { formatCommunityRelativeTime, getPublicCommunityAuthor } from "@/features/community/policy";
import type {
  CommunityHubData,
  CommunityPostEditorData,
  CommunityPostSummary,
  CommunitySearchData,
  SavedCommunityArticlesData
} from "@/features/community/types";

const articleSummaryInclude = {
  author: {
    select: {
      id: true,
      displayName: true,
      role: true
    }
  },
  likes: {
    select: {
      userId: true
    }
  },
  comments: {
    where: {
      status: "visible"
    },
    select: {
      id: true
    }
  },
  savedBy: {
    select: {
      userId: true
    }
  }
} satisfies Prisma.ArticleInclude;

type ArticleSummaryRecord = Prisma.ArticleGetPayload<{
  include: typeof articleSummaryInclude;
}>;

function createPublishedWhere(input: {
  category?: string;
  query?: string;
}): Prisma.ArticleWhereInput {
  const query = input.query?.trim();

  return {
    status: "published",
    ...(input.category
      ? {
          category: input.category
        }
      : {}),
    ...(query
      ? {
          OR: [
            {
              title: {
                contains: query
              }
            },
            {
              body: {
                contains: query
              }
            },
            {
              category: {
                contains: query
              }
            }
          ]
        }
      : {})
  };
}

function mapArticleSummary(article: ArticleSummaryRecord, session: PublicSession): CommunityPostSummary {
  const excerpt = article.body.length > 220 ? `${article.body.slice(0, 217).trim()}...` : article.body;

  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt,
    category: article.category ?? "โรคทั่วไป",
    author: getPublicCommunityAuthor(article.author),
    authorRole: article.author.role,
    time: formatCommunityRelativeTime(article.publishedAt ?? article.createdAt),
    likesCount: article.likes.length,
    commentsCount: article.comments.length,
    likedByViewer: article.likes.some((like) => like.userId === session.userId),
    savedByViewer: article.savedBy.some((saved) => saved.userId === session.userId),
    ownedByViewer: article.authorId === session.userId
  };
}

async function findPublishedArticles(input: {
  category?: string;
  query?: string;
  take?: number;
}) {
  return prisma.article.findMany({
    where: createPublishedWhere(input),
    orderBy: [
      {
        publishedAt: "desc"
      },
      {
        createdAt: "desc"
      }
    ],
    take: input.take ?? 30,
    include: articleSummaryInclude
  });
}

export async function getCommunityHub(
  session: PublicSession,
  selectedCategory = ""
): Promise<CommunityHubData> {
  noStore();

  try {
    const records = await findPublishedArticles({
      category: selectedCategory || undefined,
      take: 30
    });
    const posts = records.map((article) => mapArticleSummary(article, session));

    return {
      posts,
      featured:
        posts.find((post) => post.authorRole !== "customer") ??
        posts[0] ??
        null,
      selectedCategory
    };
  } catch {
    return {
      posts: [],
      featured: null,
      selectedCategory,
      unavailable: true
    };
  }
}

export async function searchCommunityArticles(
  session: PublicSession,
  input: {
    query?: string;
    category?: string;
  }
): Promise<CommunitySearchData> {
  noStore();
  const query = input.query?.trim() ?? "";
  const category = input.category?.trim() ?? "";

  try {
    const records = await findPublishedArticles({
      query,
      category: category || undefined,
      take: 50
    });

    return {
      query,
      category,
      results: records.map((article) => mapArticleSummary(article, session))
    };
  } catch {
    return {
      query,
      category,
      results: [],
      unavailable: true
    };
  }
}

export async function getSavedCommunityArticles(
  session: PublicSession
): Promise<SavedCommunityArticlesData> {
  noStore();

  try {
    const saved = await prisma.savedArticle.findMany({
      where: {
        userId: session.userId,
        article: {
          status: "published"
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 50,
      include: {
        article: {
          include: articleSummaryInclude
        }
      }
    });

    return {
      articles: saved.map((item) => mapArticleSummary(item.article, session))
    };
  } catch {
    return {
      articles: [],
      unavailable: true
    };
  }
}

export async function getOwnCommunityPostForEdit(
  slug: string,
  session: PublicSession
): Promise<CommunityPostEditorData | null> {
  noStore();

  const article = await prisma.article.findFirst({
    where: {
      slug,
      authorId: session.userId,
      status: {
        in: ["draft", "published"]
      }
    },
    select: {
      id: true,
      slug: true,
      title: true,
      body: true,
      category: true
    }
  });

  if (!article) {
    return null;
  }

  return {
    ...article,
    category: article.category ?? "โรคทั่วไป"
  };
}
