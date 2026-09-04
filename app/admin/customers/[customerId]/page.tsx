import { AdminCustomerDetail } from "@/features/admin/AdminCustomerDetail";
import { getAdminCustomerDetail } from "@/features/admin/customers/queries";
import { requireAdminSession } from "@/lib/auth/guards";

export default async function AdminCustomerDetailPage({
  params
}: {
  params: Promise<{
    customerId: string;
  }>;
}) {
  const session = await requireAdminSession();
  const { customerId } = await params;
  const data = await getAdminCustomerDetail(customerId);

  return <AdminCustomerDetail currentUserId={session.userId} data={data} />;
}
