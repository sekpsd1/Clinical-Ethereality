import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";

export type AdminDoctorInvitationStatus = "active" | "claimed" | "approved" | "expired" | "revoked";

export type AdminDoctorInvitationItem = {
  id: string;
  status: AdminDoctorInvitationStatus;
  createdAt: string;
  expiresAt: string;
  claimedAt: string | null;
  claimedByName: string | null;
};

function getInvitationStatus(
  invitation: {
    claimedAt: Date | null;
    expiresAt: Date;
    revokedAt: Date | null;
    claimedBy: {
      role: string;
      doctorProfile: { status: string } | null;
    } | null;
  },
  now: Date
): AdminDoctorInvitationStatus {
  if (invitation.revokedAt) return "revoked";
  if (invitation.claimedBy?.role === "doctor" && invitation.claimedBy.doctorProfile?.status === "approved") {
    return "approved";
  }
  if (invitation.claimedAt) return "claimed";
  if (invitation.expiresAt <= now) return "expired";
  return "active";
}

export async function getAdminDoctorInvitations(
  actorId: string,
  now = new Date()
): Promise<AdminDoctorInvitationItem[]> {
  noStore();

  const actor = await prisma.user.findFirst({
    where: { id: actorId, role: "admin", status: "active" },
    select: { id: true }
  });
  if (!actor) return [];

  const invitations = await prisma.doctorInvitation.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      claimedAt: true,
      revokedAt: true,
      claimedBy: {
        select: {
          displayName: true,
          fullName: true,
          lineUserId: true,
          role: true,
          doctorProfile: { select: { status: true } }
        }
      }
    }
  });

  return invitations.map((invitation) => ({
    id: invitation.id,
    status: getInvitationStatus(invitation, now),
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
    claimedAt: invitation.claimedAt?.toISOString() ?? null,
    claimedByName:
      invitation.claimedBy?.fullName ??
      invitation.claimedBy?.displayName ??
      invitation.claimedBy?.lineUserId ??
      null
  }));
}
