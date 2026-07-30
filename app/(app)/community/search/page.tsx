import { CommunitySearchResults } from "@/features/community/CommunitySearchResults";
import { searchCommunityArticles } from "@/features/community/queries";
import { communityCategories } from "@/features/community/policy";
import { requireCurrentSession } from "@/lib/auth/session";

export default async function CommunitySearchPage({
  searchParams
}: {
  searchParams: Promise<{
    category?: string;
    q?: string;
  }>;
}) {
  const [session, params] = await Promise.all([requireCurrentSession(), searchParams]);
  const category = communityCategories.includes(params.category as (typeof communityCategories)[number])
    ? params.category ?? ""
    : "";
  const data = await searchCommunityArticles(session, {
    query: params.q,
    category
  });

  return <CommunitySearchResults data={data} />;
}
