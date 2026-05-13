import { PharmacistPrescriptions } from "@/features/pharmacist/PharmacistPrescriptions";
import { getPharmacistPrescriptions } from "@/features/pharmacist/prescriptions/queries";

export default async function PharmacistPrescriptionsPage() {
  const data = await getPharmacistPrescriptions();

  return <PharmacistPrescriptions data={data} />;
}
