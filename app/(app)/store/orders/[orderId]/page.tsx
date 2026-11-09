import { CustomerOrderDetail } from "@/features/orders/CustomerOrderDetail";
import { getCustomerOrders } from "@/features/orders/queries";
import { getOrderReceiptHref } from "@/features/orders/receipt";
import { requireCurrentSession } from "@/lib/auth/session";

export default async function StoreOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const [{ orderId }, session] = await Promise.all([params, requireCurrentSession()]);
  const data = await getCustomerOrders(session);
  const order = data.orders.find((item) => item.id === orderId || item.orderCode.toLowerCase() === orderId.toLowerCase()) ?? null;

  const receiptHref = order?.paymentStatus === "verified" ? await getOrderReceiptHref(session, order.id) : null;
  return <CustomerOrderDetail order={order} unavailable={data.unavailable} receiptHref={receiptHref} />;
}
