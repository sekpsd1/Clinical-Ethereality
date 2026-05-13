import { AdminProducts } from "@/features/admin/AdminProducts";
import { getAdminProducts } from "@/features/admin/products/queries";

export default async function AdminProductsPage() {
  const data = await getAdminProducts();

  return <AdminProducts data={data} />;
}
