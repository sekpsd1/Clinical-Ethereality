import { AdminModeration } from "@/features/admin/AdminModeration";
import { getAdminModerationQueue } from "@/features/admin/moderation/queries";

export default async function AdminModerationPage() {
  const data = await getAdminModerationQueue();

  return <AdminModeration data={data} />;
}
