import { SavedArticles } from "@/features/profile/SavedArticles";
import { getSavedCommunityArticles } from "@/features/community/queries";
import { requireCurrentSession } from "@/lib/auth/session";

export default async function SavedArticlesPage() {
  const session = await requireCurrentSession();
  const data = await getSavedCommunityArticles(session);

  return <SavedArticles data={data} />;
}
