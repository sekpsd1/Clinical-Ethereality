import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const pendingDoctorStatusPath = "/doctor-invite/status" as const;

type PendingDoctorLookupClient = Pick<Prisma.TransactionClient, "user">;

export async function requiresDoctorInvitationStatus(
  userId: string,
  client: PendingDoctorLookupClient = prisma
): Promise<boolean> {
  const user = await client.user.findFirst({
    where: {
      id: userId,
      status: "active",
      claimedDoctorInvitations: {
        some: {
          role: "doctor",
          claimedAt: { not: null },
          revokedAt: null
        }
      },
      OR: [
        { role: "customer", doctorProfile: { is: { status: "pending_review" } } },
        { role: "doctor", doctorProfile: { is: { status: "approved" } } }
      ]
    },
    select: { id: true }
  });

  return Boolean(user);
}

export async function hasPendingDoctorInvitation(
  userId: string,
  client: PendingDoctorLookupClient = prisma
): Promise<boolean> {
  const user = await client.user.findFirst({
    where: {
      id: userId,
      role: "customer",
      status: "active",
      doctorProfile: {
        is: {
          status: "pending_review"
        }
      },
      claimedDoctorInvitations: {
        some: {
          role: "doctor",
          claimedAt: {
            not: null
          },
          revokedAt: null
        }
      }
    },
    select: {
      id: true
    }
  });

  return Boolean(user);
}
