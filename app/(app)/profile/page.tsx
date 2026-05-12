import { StitchedScreenPlaceholder } from "@/components/ui/StitchedScreenPlaceholder";

export default function ProfilePage() {
  return (
    <StitchedScreenPlaceholder
      eyebrow="Profile"
      title="User profile"
      description="Profile hub will connect advice logs, order history, saved articles, shipping addresses, settings, and logout."
      statusItems={["Member status", "Advice history", "Orders", "Settings"]}
    />
  );
}
