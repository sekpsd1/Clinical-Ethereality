import { NextRequest, NextResponse } from "next/server";
import {
  getZoomExternalAccessCookieOptions,
  revokeCurrentZoomExternalSession,
  zoomExternalAccessCookieName
} from "@/features/consultations/zoom/external-handoff";
import { hasTrustedZoomHandoffOrigin } from "@/features/consultations/zoom/handoff-request";

export const dynamic = "force-dynamic";

function response(body: { ok: boolean; revoked?: boolean; error?: string }, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store"
    }
  });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedZoomHandoffOrigin(request)) {
    return response({ ok: false }, 403);
  }

  try {
    const result = await revokeCurrentZoomExternalSession();
    const leaveResponse = result.revoked
      ? response({ ok: true, revoked: true })
      : response({ ok: false, revoked: false, error: "zoom_external_session_unavailable" }, 401);
    leaveResponse.cookies.set(
      zoomExternalAccessCookieName,
      "",
      getZoomExternalAccessCookieOptions(0)
    );
    return leaveResponse;
  } catch {
    return response({ ok: false }, 503);
  }
}
