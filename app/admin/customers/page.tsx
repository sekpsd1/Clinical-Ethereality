import { AdminCustomers } from "@/features/admin/AdminCustomers";
import { getAdminCustomers } from "@/features/admin/customers/queries";

export default async function AdminCustomersPage() {
  const data = await getAdminCustomers();

  return <AdminCustomers data={data} />;
}
