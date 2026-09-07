import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  exchangeZoomExternalHandoff,
  getZoomExternalAccessCookieOptions,
  getZoomExternalViewer,
  zoomExternalAccessCookieName,
  ZoomExternalHandoffError
} from "@/features/consultations/zoom/external-handoff";
import { hasTrustedZoomHandoffOrigin } from "@/features/consultations/zoom/handoff-request";

export const dynamic = "force-dynamic";

const exchangeSchema = z.object({
  ticket: z.string().trim().min(80).max(160)
});
const consultationIdSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{8,191}$/);

function invalidSessionResponse(status = 401, clearCookie = true) {
  const response = NextResponse.json(
    { ok: false, error: "Temporary Zoom access is invalid or expired." },
    { status, headers: { "Cache-Control": "no-store" } }
  );
  if (clearCookie) {
    response.cookies.set(zoomExternalAccessCookieName, "", getZoomExternalAccessCookieOptions(0));
  }
  return response;
}

export async function POST(request: NextRequest) {
  if (!hasTrustedZoomHandoffOrigin(request)) {
    return invalidSessionResponse(403, false);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return invalidSessionResponse(400, false);
  }

  const parsed = exchangeSchema.safeParse(payload);

  if (!parsed.success) {
    return invalidSessionResponse(400, false);
  }

  try {
    const exchanged = await exchangeZoomExternalHandoff(parsed.data.ticket);
    const response = NextResponse.json(
      {
        ok: true,
        consultationId: exchanged.consultationId,
        expiresAt: exchanged.expiresAt.toISOString()
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
    response.cookies.set(
      zoomExternalAccessCookieName,
      exchanged.externalSessionToken,
      getZoomExternalAccessCookieOptions()
    );
    return response;
  } catch (error) {
    if (!(error instanceof ZoomExternalHandoffError)) {
      console.error("Zoom external handoff exchange failed.", {
        code: "unexpected"
      });
    }

    return invalidSessionResponse(401, false);
  }
}

export async function GET(request: NextRequest) {
  const consultationId = consultationIdSchema.safeParse(request.nextUrl.searchParams.get("consultation"));

  if (!consultationId.success) {
    return invalidSessionResponse(400);
  }

  const viewer = await getZoomExternalViewer(consultationId.data);

  if (!viewer) {
    return invalidSessionResponse();
  }

  return NextResponse.json(
    { ok: true, consultationId: consultationId.data },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
