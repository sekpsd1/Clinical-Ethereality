import { requireCurrentSession } from "@/lib/auth/session";
import { getCustomerConsentData } from "@/features/legal/queries";
import { ProfileSettings } from "@/features/profile/ProfileSettings";
import { getCustomerProfileData } from "@/features/profile/queries";

export default async function ProfileSettingsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section } = await searchParams;
  const session = await requireCurrentSession();
  const [consentData, profileData] = await Promise.all([
    getCustomerConsentData(session),
    getCustomerProfileData(session)
  ]);

  return <ProfileSettings consentData={consentData} profileData={profileData} section={section} />;
}
