import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuthSessionRecord, setSessionCookies } from "@/lib/auth/session";
import type { AuthSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { getAppEnv } from "@/lib/env/schema";

const devSessionRequestSchema = z.object({
  role: z.enum(["customer", "doctor", "pharmacist", "admin"]).default("customer"),
  persistRefreshSession: z.boolean().default(false)
});

function isDevBypassAllowed(): boolean {
  const env = getAppEnv();

  return process.env.NODE_ENV !== "production" && env.ENABLE_DEV_AUTH_BYPASS;
}

function usesLocalDatabase(): boolean {
  try {
    const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
    return databaseUrl.hostname === "127.0.0.1" || databaseUrl.hostname === "localhost";
  } catch {
    return false;
  }
}

function usesApprovedLocalRefreshDatabase(): boolean {
  try {
    const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
    const databaseName = decodeURIComponent(databaseUrl.pathname).replace(/^\/+/, "");

    return (
      (databaseUrl.hostname === "127.0.0.1" || databaseUrl.hostname === "localhost") &&
      (databaseName === "clinical_ethereality" || databaseName === "clinical_ethereality_host_copy")
    );
  } catch {
    return false;
  }
}

const devLineUserIds = {
  customer: "seed-line-customer",
  doctor: "seed-line-doctor-approved",
  pharmacist: "seed-line-pharmacist-approved",
  admin: "seed-line-admin"
} as const;

async function getDevSession(role: keyof typeof devLineUserIds): Promise<AuthSession> {
  try {
    let user = await prisma.user.findUnique({
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

    if ((!user || user.status !== "active" || user.role !== role) && usesLocalDatabase()) {
      user = await prisma.user.findFirst({
        where: {
          role,
          status: "active",
          ...(role === "doctor"
            ? {
                doctorProfile: {
                  status: "approved"
                }
              }
            : role === "pharmacist"
              ? {
                  pharmacistProfile: {
                    status: "approved"
                  }
                }
              : {})
        },
        orderBy: [
          {
            lastLoginAt: "desc"
          },
          {
            createdAt: "asc"
          }
        ],
        select: {
          id: true,
          lineUserId: true,
          role: true,
          displayName: true,
          avatarUrl: true,
          status: true
        }
      });
    }

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
  const baseSession = await getDevSession(role);

  if (parsed.data.persistRefreshSession && (!usesApprovedLocalRefreshDatabase() || baseSession.userId.startsWith("dev:"))) {
    return NextResponse.json(
      { ok: false, error: "Persistent refresh testing requires the seeded local database." },
      { status: 503 }
    );
  }

  const session = parsed.data.persistRefreshSession
    ? await createAuthSessionRecord(baseSession, {
        userAgent: request.headers.get("user-agent"),
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
      })
    : baseSession;
  const response = NextResponse.json({
    ok: true,
    session
  });

  return setSessionCookies(response, session);
}
