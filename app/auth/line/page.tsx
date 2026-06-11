import { LineLiffLogin } from "@/features/auth/LineLiffLogin";
import { getAppEnv } from "@/lib/env/schema";

export default async function LineAuthPage({
  searchParams
}: {
  searchParams?: Promise<{
    forceRoleSelect?: string;
    next?: string;
  }>;
}) {
  const params = await searchParams;
  const env = getAppEnv();
  const allowDevBypass = process.env.NODE_ENV !== "production" && env.ENABLE_DEV_AUTH_BYPASS;

  return (
    <LineLiffLogin
      allowDevBypass={allowDevBypass}
      forceRoleSelect={params?.forceRoleSelect === "1"}
      nextPath={params?.next ?? "/consult/assessment"}
    />
  );
}
