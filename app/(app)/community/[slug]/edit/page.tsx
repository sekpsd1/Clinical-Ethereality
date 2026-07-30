import { notFound } from "next/navigation";
import { CommunityPostForm } from "@/features/community/CommunityPostForm";
import { getOwnCommunityPostForEdit } from "@/features/community/queries";
import { requireCurrentSession } from "@/lib/auth/session";

export default async function EditCommunityPostPage({
  params
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const [session, routeParams] = await Promise.all([requireCurrentSession(), params]);
  const post = await getOwnCommunityPostForEdit(routeParams.slug, session);

  if (!post) {
    notFound();
  }

  return <CommunityPostForm mode="edit" post={post} />;
}
