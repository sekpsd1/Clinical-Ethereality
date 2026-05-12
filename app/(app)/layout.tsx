import { AppShell } from "@/components/layout/AppShell";

export default function CustomerAppLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell>{children}</AppShell>;
}
