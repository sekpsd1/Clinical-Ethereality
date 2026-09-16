import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  DoctorInviteError,
  doctorInviteLimits,
  exchangeDoctorInviteToken,
  getDoctorInviteCookieName,
  getDoctorInviteCookieOptions
} from "@/features/staff-invite/doctor-invite";
import {
  doctorInvitePrivateHeaders,
  hasTrustedDoctorInviteOrigin
} from "@/features/staff-invite/doctor-invite-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ token: z.string().trim().min(80).max(doctorInviteLimits.rawTokenMaxLength) }).strict();

function unavailable(status = 400) {
  const response = NextResponse.json(
    { ok: false, state: "unavailable" },
    { status, headers: doctorInvitePrivateHeaders }
  );
  response.cookies.set(getDoctorInviteCookieName(), "", getDoctorInviteCookieOptions(0));
  return response;
}

export async function POST(request: NextRequest) {
  if (!hasTrustedDoctorInviteOrigin(request)) return unavailable(403);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return unavailable();

  try {
    const exchanged = await exchangeDoctorInviteToken(parsed.data.token);
    const maxAge = Math.max(1, Math.floor((exchanged.expiresAt.getTime() - Date.now()) / 1000));
    const response = NextResponse.json(
      { ok: true, state: "ready", expiresAt: exchanged.expiresAt.toISOString() },
      { headers: doctorInvitePrivateHeaders }
    );
    response.cookies.set(
      getDoctorInviteCookieName(),
      exchanged.ticket,
      getDoctorInviteCookieOptions(maxAge)
    );
    return response;
  } catch (error) {
    if (!(error instanceof DoctorInviteError)) {
      console.error("Doctor invitation exchange failed.", { code: "unexpected" });
    }
    return unavailable();
  }
}
