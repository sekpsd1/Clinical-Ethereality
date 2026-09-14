import { AdminModeration } from "@/features/admin/AdminModeration";
import { getAdminModerationQueue } from "@/features/admin/moderation/queries";
import { getAdminPinnedPostsData } from "@/features/community/pinning/queries";

export default async function AdminModerationPage() {
  const [data, pinnedPosts] = await Promise.all([
    getAdminModerationQueue(),
    getAdminPinnedPostsData()
  ]);

  return <AdminModeration data={data} pinnedPosts={pinnedPosts} />;
}
