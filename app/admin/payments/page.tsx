import { AdminPayments } from "@/features/admin/AdminPayments";
import { getAdminPayments } from "@/features/admin/payments/queries";

export default async function AdminPaymentsPage() {
  const data = await getAdminPayments();

  return <AdminPayments data={data} />;
}
