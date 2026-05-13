import { DoctorShell } from "@/components/layout/DoctorShell";
import { requireDoctorSession } from "@/lib/auth/guards";

export default async function DoctorLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireDoctorSession();

  return <DoctorShell>{children}</DoctorShell>;
}
