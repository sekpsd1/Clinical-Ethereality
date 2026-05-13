import { PharmacistOrders } from "@/features/pharmacist/PharmacistOrders";
import { getPharmacistOrders } from "@/features/pharmacist/orders/queries";

export default async function PharmacistOrdersPage() {
  const data = await getPharmacistOrders();

  return <PharmacistOrders data={data} />;
}
