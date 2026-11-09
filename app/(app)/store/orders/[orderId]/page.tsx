import { headers } from "next/headers";
import { getAppEnv } from "@/lib/env/schema";
import { CustomerOrderDetail } from "@/features/orders/CustomerOrderDetail";
import { getCustomerOrders } from "@/features/orders/queries";
import { getOrderReceiptDetails } from "@/features/orders/receipt";
import { requireCurrentSession } from "@/lib/auth/session";

export default async function StoreOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const [{ orderId }, session] = await Promise.all([params, requireCurrentSession()]);
  const data = await getCustomerOrders(session);
  const order = data.orders.find((item) => item.id === orderId || item.orderCode.toLowerCase() === orderId.toLowerCase()) ?? null;

  const receiptDetails = order?.paymentStatus === "verified" ? await getOrderReceiptDetails(session, order.id) : null;
  const userAgent = (await headers()).get("user-agent") ?? "";
  return (
    <CustomerOrderDetail
      order={order}
      unavailable={data.unavailable}
      receiptDetails={receiptDetails}
      inLine={/\bLINE\//i.test(userAgent)}
      liffId={getAppEnv().NEXT_PUBLIC_LINE_LIFF_ID}
    />
  );
}
