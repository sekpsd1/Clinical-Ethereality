import { PrescriptionOrderScreen } from "@/features/products/PrescriptionOrderScreen";
import { getPrescriptionOrderData } from "@/features/products/prescriptions/queries";
import { requireCurrentSession } from "@/lib/auth/session";
import { getCustomerShippingAddresses } from "@/features/profile/shipping-addresses/queries";

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
  const [data, addresses] = await Promise.all([getPrescriptionOrderData(session, routeParams.prescriptionId), getCustomerShippingAddresses(session)]);

  return <PrescriptionOrderScreen data={data} orderStatus={queryParams.order} addresses={addresses} />;
}
