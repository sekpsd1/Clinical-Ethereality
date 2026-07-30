import { CommunityHub } from "@/features/community/CommunityHub";
import { getCommunityHub } from "@/features/community/queries";
import { communityCategories } from "@/features/community/policy";
import { requireCurrentSession } from "@/lib/auth/session";

export default async function CommunityPage({
  searchParams
}: {
  searchParams: Promise<{
    category?: string;
    reported?: string;
  }>;
}) {
  const [session, params] = await Promise.all([requireCurrentSession(), searchParams]);
  const category = communityCategories.includes(params.category as (typeof communityCategories)[number])
    ? params.category ?? ""
    : "";
  const data = await getCommunityHub(session, category);

  return <CommunityHub data={data} reported={params.reported} />;
}
