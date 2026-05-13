import { PrescriptionStatusScreen } from "@/features/consultations/PrescriptionStatusScreen";
import { getCustomerPrescriptions } from "@/features/consultations/prescriptions/queries";
import { requireCurrentSession } from "@/lib/auth/session";

export default async function CustomerPrescriptionStatusPage() {
  const session = await requireCurrentSession();
  const data = await getCustomerPrescriptions(session);

  return <PrescriptionStatusScreen data={data} />;
}
