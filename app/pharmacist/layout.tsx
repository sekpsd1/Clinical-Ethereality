import { PharmacistShell } from "@/components/layout/PharmacistShell";
import { requirePharmacistSession } from "@/lib/auth/guards";

export default async function PharmacistLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requirePharmacistSession();

  return <PharmacistShell>{children}</PharmacistShell>;
}
