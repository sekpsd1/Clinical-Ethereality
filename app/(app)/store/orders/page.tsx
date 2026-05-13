import { CustomerOrders } from "@/features/orders/CustomerOrders";
import { getCustomerOrders } from "@/features/orders/queries";
import { requireCurrentSession } from "@/lib/auth/session";

export default async function StoreOrdersPage() {
  const session = await requireCurrentSession();
  const data = await getCustomerOrders(session);

  return <CustomerOrders data={data} />;
}
