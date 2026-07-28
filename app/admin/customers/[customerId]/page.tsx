import { AdminCustomerDetail } from "@/features/admin/AdminCustomerDetail";
import { getAdminCustomerDetail } from "@/features/admin/customers/queries";

export default async function AdminCustomerDetailPage({
  params
}: {
  params: Promise<{
    customerId: string;
  }>;
}) {
  const { customerId } = await params;
  const data = await getAdminCustomerDetail(customerId);

  return <AdminCustomerDetail data={data} />;
}
