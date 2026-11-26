import { AdminPayments } from "@/features/admin/AdminPayments";
import { getAdminPayments } from "@/features/admin/payments/queries";
import { parseDocumentQueuePage } from "@/features/admin/document-queue-pagination";

export default async function AdminPaymentsPage({ searchParams }: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { page } = await searchParams;
  const data = await getAdminPayments(parseDocumentQueuePage(page));

  return <AdminPayments data={data} />;
}
