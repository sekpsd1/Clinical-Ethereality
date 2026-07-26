import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enrichLineIdentityWithProfile, verifyLineIdToken } from "@/lib/auth/line";
import { createAuthSessionRecord, setSessionCookies } from "@/lib/auth/session";
import { upsertLineCustomer } from "@/lib/auth/users";

const lineSessionRequestSchema = z.object({
  idToken: z.string().min(1),
  accessToken: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const parsed = lineSessionRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "A valid LINE ID token is required." }, { status: 400 });
  }

  let step = "verify_line_token";

  try {
    const verifiedIdentity = await verifyLineIdToken(parsed.data.idToken);
    const identity = await enrichLineIdentityWithProfile(verifiedIdentity, parsed.data.accessToken);
    step = "upsert_user";
    const userSession = await upsertLineCustomer(identity);
    step = "create_auth_session";
    const session = await createAuthSessionRecord(userSession, {
      userAgent: request.headers.get("user-agent"),
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    });
    const response = NextResponse.json({
      ok: true,
      session: {
        userId: session.userId,
        lineUserId: session.lineUserId,
        role: session.role,
        displayName: session.displayName,
        pictureUrl: session.pictureUrl
      }
    });

    return setSessionCookies(response, session);
  } catch (error) {
    const errorCode =
      typeof error === "object" && error && "code" in error && typeof error.code === "string"
        ? error.code
        : undefined;

    // Keep production responses generic while preserving a safe diagnostic signal in server logs.
    console.error("[auth/line/session] failed", {
      step,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorCode
    });

    return NextResponse.json(
      { ok: false, error: "Unable to create an app session." },
      { status: step === "verify_line_token" ? 401 : 503 }
    );
  }
}
