import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setSessionCookies } from "@/lib/auth/session";
import type { AuthSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { getAppEnv } from "@/lib/env/schema";

const devSessionRequestSchema = z.object({
  role: z.enum(["customer", "doctor", "pharmacist", "admin"]).default("customer")
});

function isDevBypassAllowed(): boolean {
  const env = getAppEnv();

  return process.env.NODE_ENV !== "production" && env.ENABLE_DEV_AUTH_BYPASS;
}

const devLineUserIds = {
  customer: "seed-line-customer",
  doctor: "seed-line-doctor-approved",
  pharmacist: "seed-line-pharmacist-approved",
  admin: "seed-line-admin"
} as const;

async function getDevSession(role: keyof typeof devLineUserIds): Promise<AuthSession> {
  try {
    const user = await prisma.user.findUnique({
      where: {
        lineUserId: devLineUserIds[role]
      },
      select: {
        id: true,
        lineUserId: true,
        role: true,
        displayName: true,
        avatarUrl: true,
        status: true
      }
    });

    if (user?.status === "active" && user.role === role) {
      return {
        userId: user.id,
        lineUserId: user.lineUserId,
        role: user.role,
        displayName: user.displayName ?? `Local ${role}`,
        pictureUrl: user.avatarUrl ?? undefined
      };
    }
  } catch {
    // Keep the local bypass usable before the database is available.
  }

  return {
    userId: `dev:${role}`,
    lineUserId: `dev-line-${role}`,
    role,
    displayName: `Local ${role}`,
    pictureUrl: undefined
  };
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
  const session = await getDevSession(role);
  const response = NextResponse.json({
    ok: true,
    session
  });

  return setSessionCookies(response, session);
}
