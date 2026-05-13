import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyLineIdToken } from "@/lib/auth/line";
import { createAuthSessionRecord, setSessionCookies } from "@/lib/auth/session";
import { upsertLineCustomer } from "@/lib/auth/users";

const lineSessionRequestSchema = z.object({
  idToken: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const parsed = lineSessionRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "A valid LINE ID token is required." }, { status: 400 });
  }

  try {
    const identity = await verifyLineIdToken(parsed.data.idToken);
    const userSession = await upsertLineCustomer(identity);
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
  } catch {
    return NextResponse.json({ ok: false, error: "Unable to verify LINE login." }, { status: 401 });
  }
}
