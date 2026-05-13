import { ArticleDetail } from "@/features/community/ArticleDetail";
import { getCommunityArticleDetail } from "@/features/community/article/queries";
import { requireCurrentSession } from "@/lib/auth/session";

export default async function ArticleDetailPage() {
  const session = await requireCurrentSession();
  const article = await getCommunityArticleDetail("vitamin-c-tips", session);

  return <ArticleDetail article={article} />;
}
