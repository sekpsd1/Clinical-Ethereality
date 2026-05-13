import { PrescriptionOrderScreen } from "@/features/products/PrescriptionOrderScreen";
import { getPrescriptionOrderData } from "@/features/products/prescriptions/queries";
import { requireCurrentSession } from "@/lib/auth/session";

export default async function PrescriptionOrderPage({
  params,
  searchParams
}: {
  params: Promise<{
    prescriptionId: string;
  }>;
  searchParams: Promise<{
    order?: string;
  }>;
}) {
  const [session, routeParams, queryParams] = await Promise.all([requireCurrentSession(), params, searchParams]);
  const data = await getPrescriptionOrderData(session, routeParams.prescriptionId);

  return <PrescriptionOrderScreen data={data} orderStatus={queryParams.order} />;
}
