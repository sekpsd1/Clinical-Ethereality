import { ArticleDetail } from "@/features/community/ArticleDetail";
import { getCommunityArticleDetail } from "@/features/community/article/queries";
import { requireCurrentSession } from "@/lib/auth/session";

export default async function CommunityArticlePage({
  params,
  searchParams
}: {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    comment?: string;
    reported?: string;
  }>;
}) {
  const [session, routeParams, feedback] = await Promise.all([
    requireCurrentSession(),
    params,
    searchParams
  ]);
  const article = await getCommunityArticleDetail(routeParams.slug, session);

  return <ArticleDetail article={article} feedback={feedback} />;
}
