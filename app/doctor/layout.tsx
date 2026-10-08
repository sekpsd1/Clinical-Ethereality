import { DoctorShell } from "@/components/layout/DoctorShell";
import { requireDoctorSession } from "@/lib/auth/guards";

export default async function DoctorLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireDoctorSession();

  return <DoctorShell viewerRole={session.role === "admin" ? "admin" : "doctor"}>{children}</DoctorShell>;
}
