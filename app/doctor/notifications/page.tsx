import { DoctorNotifications } from "@/features/doctor/DoctorNotifications";
import { getDoctorNotifications } from "@/features/doctor/notifications/queries";

export default async function DoctorNotificationsPage() {
  const data = await getDoctorNotifications();

  return <DoctorNotifications data={data} />;
}
