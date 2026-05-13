import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setSessionCookies } from "@/lib/auth/session";
import type { AuthSession } from "@/lib/auth/types";
import { getAppEnv } from "@/lib/env/schema";

const devSessionRequestSchema = z.object({
  role: z.enum(["customer", "admin"]).default("customer")
});

function isDevBypassAllowed(): boolean {
  const env = getAppEnv();

  return process.env.NODE_ENV !== "production" && env.ENABLE_DEV_AUTH_BYPASS;
}

export async function POST(request: NextRequest) {
  if (!isDevBypassAllowed()) {
    return NextResponse.json({ ok: false, error: "Dev auth bypass is disabled." }, { status: 404 });
  }

  const parsed = devSessionRequestSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid dev session role." }, { status: 400 });
  }

  const role = parsed.data.role;
  const session: AuthSession = {
    userId: `dev:${role}`,
    lineUserId: `dev-line-${role}`,
    role,
    displayName: role === "admin" ? "Local Admin" : "Local Customer",
    pictureUrl: undefined
  };
  const response = NextResponse.json({
    ok: true,
    session
  });

  return setSessionCookies(response, session);
}
