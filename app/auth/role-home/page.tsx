import type { Route } from "next";
import { redirect } from "next/navigation";
import { getRoleHomePath } from "@/features/auth/role-routing";
import { getCurrentSession } from "@/lib/auth/session";

export default async function RoleHomePage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/line?next=%2Fauth%2Frole-home");
  }

  redirect(getRoleHomePath(session.role) as Route);
}
