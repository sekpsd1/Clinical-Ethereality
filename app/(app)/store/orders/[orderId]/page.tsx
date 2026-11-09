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
  const env = getAppEnv();
  const browserUrl = order && receiptDetails && /\bLINE\//i.test(userAgent)
    ? new URL(`/store/orders/${encodeURIComponent(order.id)}`, env.NEXT_PUBLIC_APP_URL).href
    : undefined;
  return (
    <CustomerOrderDetail
      order={order}
      unavailable={data.unavailable}
      receiptDetails={receiptDetails}
      browserUrl={browserUrl}
      liffId={browserUrl ? env.NEXT_PUBLIC_LINE_LIFF_ID : undefined}
    />
  );
}
