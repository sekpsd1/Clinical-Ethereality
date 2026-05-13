import { AdminShell } from "@/components/layout/AdminShell";
import { requireAdminSession } from "@/lib/auth/guards";

export default async function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdminSession();

  return <AdminShell>{children}</AdminShell>;
}
