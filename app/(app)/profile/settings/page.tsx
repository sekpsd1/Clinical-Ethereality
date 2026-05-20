import { getCurrentSession } from "@/lib/auth/session";
import { getCustomerConsentData } from "@/features/legal/queries";
import { ProfileSettings } from "@/features/profile/ProfileSettings";

export default async function ProfileSettingsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section } = await searchParams;
  const session = await getCurrentSession();
  const consentData = await getCustomerConsentData(session);

  return <ProfileSettings consentData={consentData} section={section} />;
}
