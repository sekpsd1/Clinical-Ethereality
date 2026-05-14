import { ProfileSettings } from "@/features/profile/ProfileSettings";

export default async function ProfileSettingsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section } = await searchParams;

  return <ProfileSettings section={section} />;
}
