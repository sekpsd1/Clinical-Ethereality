import { StoreCheckout } from "@/features/products/StoreCheckout";

export default async function StoreCheckoutPage({
  searchParams
}: {
  searchParams: Promise<{
    checkout?: string;
  }>;
}) {
  const params = await searchParams;

  return <StoreCheckout checkoutStatus={params.checkout} />;
}
