import { redirect } from "next/navigation";

export default function StorePaymentSuccessPage() {
  redirect("/store/orders");
}
