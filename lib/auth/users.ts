import type { LineIdentity } from "@/lib/auth/line";
import type { AuthSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { isRole, type Role } from "@/lib/permissions/roles";

function toRole(value: string): Role {
  if (!isRole(value)) {
    throw new Error("Stored user role is not supported by the application.");
  }

  return value;
}

export async function upsertLineCustomer(identity: LineIdentity): Promise<AuthSession> {
  const user = await prisma.user.upsert({
    where: {
      lineUserId: identity.lineUserId
    },
    create: {
      lineUserId: identity.lineUserId,
      displayName: identity.displayName,
      email: identity.email,
      avatarUrl: identity.pictureUrl,
      role: "customer",
      status: "active",
      lastLoginAt: new Date()
    },
    update: {
      displayName: identity.displayName,
      email: identity.email,
      avatarUrl: identity.pictureUrl,
      lastLoginAt: new Date()
    }
  });

  if (user.status !== "active") {
    throw new Error("This account is not active.");
  }

  return {
    userId: user.id,
    lineUserId: user.lineUserId,
    role: toRole(user.role),
    displayName: user.displayName ?? undefined,
    pictureUrl: user.avatarUrl ?? undefined
  };
}
