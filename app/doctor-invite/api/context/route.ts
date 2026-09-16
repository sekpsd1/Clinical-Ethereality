import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import {
  DoctorInviteError,
  getDoctorInviteCookieName,
  getDoctorInviteCookieOptions,
  inspectDoctorInviteTicket
} from "@/features/staff-invite/doctor-invite";
import { hasPendingDoctorInvitation } from "@/features/staff-invite/pending-doctor";
import { doctorInvitePrivateHeaders } from "@/features/staff-invite/doctor-invite-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(state: string, status = 200) {
  return NextResponse.json({ ok: status < 400, state }, { status, headers: doctorInvitePrivateHeaders });
}

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();

  if (session && !session.userId.startsWith("dev:")) {
    if (await hasPendingDoctorInvitation(session.userId)) return json("pending");

    const persisted = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        role: true,
        status: true,
        doctorProfile: { select: { status: true } },
        claimedDoctorInvitations: {
          where: { role: "doctor" },
          orderBy: { claimedAt: "desc" },
          take: 1,
          select: { revokedAt: true }
        }
      }
    });

    if (persisted?.role === "doctor" && persisted.status === "active" && persisted.doctorProfile?.status === "approved") {
      return json("approved");
    }
    if (
      persisted?.role === "customer" &&
      persisted.status === "active" &&
      persisted.doctorProfile?.status === "rejected" &&
      persisted.claimedDoctorInvitations[0]?.revokedAt
    ) {
      return json("revoked");
    }
  }

  const ticket = request.cookies.get(getDoctorInviteCookieName())?.value;
  if (!ticket) return json("unavailable", 400);

  try {
    const context = await inspectDoctorInviteTicket(ticket, session?.userId);
    if (context.state === "pending_review") return json("pending");
    if (context.state !== "active") {
      const response = json("unavailable", 400);
      response.cookies.set(getDoctorInviteCookieName(), "", getDoctorInviteCookieOptions(0));
      return response;
    }
    if (!session) return json("login_required");
    if (session.userId.startsWith("dev:") || session.role !== "customer") return json("wrong_account", 403);
    return NextResponse.json(
      { ok: true, state: "ready", expiresAt: context.expiresAt.toISOString() },
      { headers: doctorInvitePrivateHeaders }
    );
  } catch (error) {
    if (!(error instanceof DoctorInviteError)) {
      console.error("Doctor invitation context failed.", { code: "unexpected" });
    }
    const response = json("unavailable", 400);
    response.cookies.set(getDoctorInviteCookieName(), "", getDoctorInviteCookieOptions(0));
    return response;
  }
}
