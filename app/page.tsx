import type { Route } from "next";
import { redirect } from "next/navigation";
import { getRoleHomePath } from "@/features/auth/role-routing";
import { getCurrentSession } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await getCurrentSession();

  if (session && session.role !== "customer") {
    redirect(getRoleHomePath(session.role) as Route);
  }

  redirect("/consult");
}
