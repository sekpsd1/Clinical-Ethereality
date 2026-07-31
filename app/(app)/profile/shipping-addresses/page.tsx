import { ShippingAddresses } from "@/features/profile/ShippingAddresses";
import { getCustomerShippingAddresses } from "@/features/profile/shipping-addresses/queries";
import { requireCurrentSession } from "@/lib/auth/session";

export default async function ShippingAddressesPage({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string; returnTo?: string }> }) {
  const session = await requireCurrentSession();
  const [params, addresses] = await Promise.all([searchParams, getCustomerShippingAddresses(session)]);
  const editingAddress = params.edit ? addresses.find((address) => address.id === params.edit) : undefined;
  const safeReturnTo = params.returnTo?.startsWith("/") && !params.returnTo.startsWith("//") ? params.returnTo : undefined;
  return <ShippingAddresses addresses={addresses} editingAddress={editingAddress} showForm={Boolean(params.new || editingAddress)} returnTo={safeReturnTo} />;
}
