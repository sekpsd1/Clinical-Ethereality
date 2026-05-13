import { AdminOrders } from "@/features/admin/AdminOrders";
import { getAdminOrders } from "@/features/admin/orders/queries";

export default async function AdminOrdersPage() {
  const data = await getAdminOrders();

  return <AdminOrders data={data} />;
}
