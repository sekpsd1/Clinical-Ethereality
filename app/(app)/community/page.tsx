import { StitchedScreenPlaceholder } from "@/components/ui/StitchedScreenPlaceholder";

export default function CommunityPage() {
  return (
    <StitchedScreenPlaceholder
      eyebrow="Community"
      title="Community hub"
      description="Community hub, create post, article detail, comments, notifications, and search follow the finalized Stitch map."
      statusItems={["Verified content", "Posts", "Comments", "Notifications"]}
    />
  );
}
