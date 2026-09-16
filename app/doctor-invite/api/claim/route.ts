import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import {
  claimDoctorInvitation,
  DoctorInviteError,
  getDoctorInviteCookieName,
  getDoctorInviteCookieOptions
} from "@/features/staff-invite/doctor-invite";
import {
  doctorInvitePrivateHeaders,
  hasTrustedDoctorInviteOrigin
} from "@/features/staff-invite/doctor-invite-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function result(state: string, status: number) {
  const response = NextResponse.json(
    { ok: status < 400, state },
    { status, headers: doctorInvitePrivateHeaders }
  );
  if (state !== "ready") {
    response.cookies.set(getDoctorInviteCookieName(), "", getDoctorInviteCookieOptions(0));
  }
  return response;
}

export async function POST(request: NextRequest) {
  if (!hasTrustedDoctorInviteOrigin(request)) return result("unavailable", 403);
  const session = await getCurrentSession();
  if (!session) return result("login_required", 401);
  if (session.userId.startsWith("dev:") || session.role !== "customer") return result("wrong_account", 403);

  const ticket = request.cookies.get(getDoctorInviteCookieName())?.value;
  if (!ticket) return result("unavailable", 400);

  try {
    await prisma.$transaction(
      (tx) => claimDoctorInvitation(tx, { userId: session.userId, ticket }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return result("pending", 200);
  } catch (error) {
    if (error instanceof DoctorInviteError) {
      return result(
        error.code === "CLAIMANT_NOT_ELIGIBLE" || error.code === "CONFLICTING_STAFF_PROFILE"
          ? "wrong_account"
          : "unavailable",
        error.code === "CLAIMANT_NOT_ELIGIBLE" || error.code === "CONFLICTING_STAFF_PROFILE" ? 403 : 409
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return result("retry", 409);
    }
    console.error("Doctor invitation claim failed.", { code: "unexpected" });
    return result("unavailable", 500);
  }
}
