import { AdminOrders } from "@/features/admin/AdminOrders";
import { getAdminOrders } from "@/features/admin/orders/queries";
import { parseDocumentQueuePage } from "@/features/admin/document-queue-pagination";

export default async function AdminOrdersPage({ searchParams }: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { page } = await searchParams;
  const data = await getAdminOrders(parseDocumentQueuePage(page));

  return <AdminOrders data={data} />;
}
