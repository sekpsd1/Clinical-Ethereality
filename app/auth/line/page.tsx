import { LineLiffLogin } from "@/features/auth/LineLiffLogin";
import { getAppEnv } from "@/lib/env/schema";

export default async function LineAuthPage({
  searchParams
}: {
  searchParams?: Promise<{
    forceRoleSelect?: string;
    error?: string;
    next?: string;
  }>;
}) {
  const params = await searchParams;
  const env = getAppEnv();
  const allowDevBypass = process.env.NODE_ENV !== "production" && env.ENABLE_DEV_AUTH_BYPASS;

  return (
    <LineLiffLogin
      allowDevBypass={allowDevBypass}
      authError={params?.error}
      forceRoleSelect={params?.forceRoleSelect === "1"}
      liffId={env.NEXT_PUBLIC_LINE_LIFF_ID}
      nextPath={params?.next ?? "/auth/role-home"}
    />
  );
}
