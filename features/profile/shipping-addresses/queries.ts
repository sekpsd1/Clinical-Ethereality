import { unstable_noStore as noStore } from "next/cache";
import type { PublicSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";
import type { ShippingAddressView } from "@/features/profile/shipping-addresses/types";

export async function getCustomerShippingAddresses(session: PublicSession): Promise<ShippingAddressView[]> {
  noStore();
  if (session.role !== "customer") {
    throw new Error("Customer access is required.");
  }
  assertPermission(session, "profile:update:self");

  const activeCustomer = await prisma.user.findFirst({
    where: { id: session.userId, role: "customer", status: "active" },
    select: { id: true }
  });
  if (!activeCustomer) {
    throw new Error("Active customer access is required.");
  }

  return prisma.shippingAddress.findMany({
    where: { userId: session.userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      label: true,
      recipientName: true,
      phone: true,
      addressLine1: true,
      addressLine2: true,
      subdistrict: true,
      district: true,
      province: true,
      postalCode: true,
      isDefault: true
    }
  });
}
