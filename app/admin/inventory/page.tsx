import { AdminInventory } from "@/features/admin/AdminInventory";
import { getAdminInventory } from "@/features/admin/inventory/queries";

export default async function AdminInventoryPage() {
  const data = await getAdminInventory();

  return <AdminInventory data={data} />;
}
