import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual
} from "node:crypto";
import { Prisma, type StaffProfileStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getAppEnv } from "@/lib/env/schema";
import { writeAuditLog } from "@/lib/audit/audit-log";
import {
  doctorInviteIdempotencyKeySchema,
  doctorInviteRawTokenSchema,
  doctorInviteTicketSchema,
  issueDoctorInvitationSchema,
  revokeDoctorInvitationSchema
} from "@/features/staff-invite/doctor-invite-schema";

const INVITE_VERSION = "v1";
const INVITE_TOKEN_PATTERN = /^v1\.([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/;
const INVITE_TICKET_PATTERN = /^v1\.([0-9a-f-]{36})\.(\d{10,13})\.([A-Za-z0-9_-]{43})$/;

export const doctorInviteLimits = {
  invitationTtlMs: 24 * 60 * 60 * 1000,
  cookieTicketTtlMs: 15 * 60 * 1000,
  rawTokenMaxLength: 191,
  ticketMaxLength: 320,
  listLimit: 50
} as const;

export type DoctorInviteErrorCode =
  | "ACTIVE_ADMIN_REQUIRED"
  | "INVALID_IDEMPOTENCY_KEY"
  | "INVALID_ORIGIN"
  | "INVALID_INVITATION"
  | "INVITATION_EXPIRED"
  | "INVITATION_REVOKED"
  | "INVITATION_USED"
  | "CLAIMANT_NOT_ELIGIBLE"
  | "CONFLICTING_STAFF_PROFILE"
  | "INVITATION_STATE_INVALID";

export class DoctorInviteError extends Error {
  constructor(public readonly code: DoctorInviteErrorCode) {
    super(code);
    this.name = "DoctorInviteError";
  }
}

export type DoctorInviteState = "active" | "pending_review" | "used" | "expired" | "revoked";

export type DoctorInviteSafeContext = {
  invitationId: string;
  state: DoctorInviteState;
  expiresAt: Date;
  claimedAt: Date | null;
  canClaim: boolean;
};

export const getDoctorInviteCookieName = () => "ce_doctor_invite";

export function getDoctorInviteCookieOptions(maxAge = Math.floor(doctorInviteLimits.cookieTicketTtlMs / 1000)) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/doctor-invite",
    maxAge
  };
}

function getSigningSecret(): string {
  let secret: string | undefined;

  try {
    secret = getAppEnv().JWT_SECRET;
  } catch {
    throw new DoctorInviteError("INVITATION_STATE_INVALID");
  }

  if (!secret) {
    throw new DoctorInviteError("INVITATION_STATE_INVALID");
  }

  return secret;
}

function sha256(domain: string, value: string): string {
  return createHash("sha256").update(`${domain}\0${value}`, "utf8").digest("hex");
}

function hmac(domain: string, value: string): string {
  return createHmac("sha256", getSigningSecret())
    .update(`${domain}\0${value}`, "utf8")
    .digest("base64url");
}

function hashesMatch(expected: string | null | undefined, actual: string): boolean {
  if (!expected || expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(actual, "utf8"));
}

function normalizeOrigin(value: string): string {
  const parsed = issueDoctorInvitationSchema.shape.origin.safeParse(value);

  if (!parsed.success) {
    throw new DoctorInviteError("INVALID_ORIGIN");
  }

  return new URL(parsed.data).origin;
}

function creationKeyHash(actorId: string, idempotencyKey: string): string {
  return sha256("doctor-invitation-creation:v1", `${actorId}\0${idempotencyKey}`);
}

function createInviteToken(invitationId: string, actorId: string, idempotencyKey: string): string {
  const signature = hmac(
    "doctor-invitation-token:v1",
    `${invitationId}\0${actorId}\0${idempotencyKey}`
  );
  return `${INVITE_VERSION}.${invitationId}.${signature}`;
}

function tokenHash(token: string): string {
  return sha256("doctor-invitation-token:v1", token);
}

function parseInviteToken(token: string): { invitationId: string } | null {
  const parsed = doctorInviteRawTokenSchema.safeParse(token);
  if (!parsed.success) return null;
  const match = INVITE_TOKEN_PATTERN.exec(parsed.data);
  return match ? { invitationId: match[1] } : null;
}

function createCookieTicket(invitationId: string, expiresAt: Date): string {
  const expiresAtMs = expiresAt.getTime();
  const signature = hmac("doctor-invitation-cookie:v1", `${invitationId}\0${expiresAtMs}`);
  return `${INVITE_VERSION}.${invitationId}.${expiresAtMs}.${signature}`;
}

function parseAndVerifyCookieTicket(ticket: string, now: Date): { invitationId: string; expiresAt: Date } {
  const parsed = doctorInviteTicketSchema.safeParse(ticket);
  const match = parsed.success ? INVITE_TICKET_PATTERN.exec(parsed.data) : null;

  if (!match) {
    throw new DoctorInviteError("INVALID_INVITATION");
  }

  const invitationId = match[1];
  const expiresAtMs = Number(match[2]);
  const expectedSignature = hmac(
    "doctor-invitation-cookie:v1",
    `${invitationId}\0${expiresAtMs}`
  );

  if (!Number.isSafeInteger(expiresAtMs) || !hashesMatch(expectedSignature, match[3])) {
    throw new DoctorInviteError("INVALID_INVITATION");
  }

  const expiresAt = new Date(expiresAtMs);
  if (expiresAt <= now) {
    throw new DoctorInviteError("INVITATION_EXPIRED");
  }

  return { invitationId, expiresAt };
}

async function lockAndRequireActiveAdmin(tx: Prisma.TransactionClient, actorId: string): Promise<void> {
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`User\` WHERE \`id\` = ${actorId} FOR UPDATE`
  );
  const actor = await tx.user.findUnique({
    where: { id: actorId },
    select: { role: true, status: true }
  });

  if (!actor || actor.role !== "admin" || actor.status !== "active") {
    throw new DoctorInviteError("ACTIVE_ADMIN_REQUIRED");
  }
}

function safeInviteState(
  invitation: {
    claimedById: string | null;
    claimedAt: Date | null;
    revokedAt: Date | null;
    expiresAt: Date;
    claimedBy?: { doctorProfile: { status: StaffProfileStatus } | null } | null;
  },
  userId: string | undefined,
  now: Date
): DoctorInviteState {
  if (invitation.revokedAt) return "revoked";
  if (invitation.claimedAt || invitation.claimedById) {
    return invitation.claimedById === userId && invitation.claimedBy?.doctorProfile?.status === "pending_review"
      ? "pending_review"
      : "used";
  }
  if (invitation.expiresAt <= now) return "expired";
  return "active";
}

export async function issueDoctorInvitation(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    idempotencyKey: string;
    origin: string;
    now?: Date;
  }
) {
  const parsedKey = doctorInviteIdempotencyKeySchema.safeParse(input.idempotencyKey);
  if (!parsedKey.success) {
    throw new DoctorInviteError("INVALID_IDEMPOTENCY_KEY");
  }

  const origin = normalizeOrigin(input.origin);
  const now = input.now ?? new Date();
  const keyHash = creationKeyHash(input.actorId, parsedKey.data);

  await lockAndRequireActiveAdmin(tx, input.actorId);

  const existing = await tx.doctorInvitation.findUnique({
    where: { creationKeyHash: keyHash }
  });

  if (existing) {
    if (existing.createdById !== input.actorId || existing.role !== "doctor") {
      throw new DoctorInviteError("INVITATION_STATE_INVALID");
    }
    const token = createInviteToken(existing.id, input.actorId, parsedKey.data);
    if (!hashesMatch(existing.tokenHash, tokenHash(token))) {
      throw new DoctorInviteError("INVITATION_STATE_INVALID");
    }
    return {
      invitationId: existing.id,
      inviteUrl: `${origin}/doctor-invite#${token}`,
      expiresAt: existing.expiresAt,
      reused: true
    };
  }

  const invitationId = randomUUID();
  const token = createInviteToken(invitationId, input.actorId, parsedKey.data);
  const expiresAt = new Date(now.getTime() + doctorInviteLimits.invitationTtlMs);
  const invitation = await tx.doctorInvitation.create({
    data: {
      id: invitationId,
      role: "doctor",
      tokenHash: tokenHash(token),
      creationKeyHash: keyHash,
      createdById: input.actorId,
      expiresAt
    },
    select: { id: true, expiresAt: true, createdAt: true }
  });

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: "doctor_invitation.issue",
    entityType: "doctor_invitation",
    entityId: invitation.id,
    metadata: {
      role: "doctor",
      status: "active",
      createdAt: invitation.createdAt.toISOString(),
      expiresAt: invitation.expiresAt.toISOString()
    }
  });

  return {
    invitationId: invitation.id,
    inviteUrl: `${origin}/doctor-invite#${token}`,
    expiresAt: invitation.expiresAt,
    reused: false
  };
}

export async function listDoctorInvitations(actorId: string, now = new Date()) {
  const actor = await prisma.user.findFirst({
    where: { id: actorId, role: "admin", status: "active" },
    select: { id: true }
  });
  if (!actor) throw new DoctorInviteError("ACTIVE_ADMIN_REQUIRED");

  const invitations = await prisma.doctorInvitation.findMany({
    where: { role: "doctor" },
    orderBy: { createdAt: "desc" },
    take: doctorInviteLimits.listLimit,
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      claimedAt: true,
      revokedAt: true,
      claimedById: true,
      createdBy: { select: { displayName: true } },
      claimedBy: {
        select: {
          displayName: true,
          fullName: true,
          doctorProfile: { select: { status: true } }
        }
      }
    }
  });

  return invitations.map((invitation) => ({
    id: invitation.id,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    claimedAt: invitation.claimedAt,
    revokedAt: invitation.revokedAt,
    state: safeInviteState(invitation, undefined, now),
    createdByName: invitation.createdBy.displayName,
    claimedByName: invitation.claimedBy?.fullName ?? invitation.claimedBy?.displayName ?? null
  }));
}

export async function revokeDoctorInvitation(
  tx: Prisma.TransactionClient,
  input: { actorId: string; invitationId: string; now?: Date }
) {
  const parsed = revokeDoctorInvitationSchema.safeParse({ invitationId: input.invitationId });
  if (!parsed.success) throw new DoctorInviteError("INVALID_INVITATION");
  const now = input.now ?? new Date();

  await lockAndRequireActiveAdmin(tx, input.actorId);
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`DoctorInvitation\` WHERE \`id\` = ${parsed.data.invitationId} FOR UPDATE`
  );
  const invitation = await tx.doctorInvitation.findUnique({
    where: { id: parsed.data.invitationId },
    select: {
      id: true,
      role: true,
      claimedById: true,
      revokedAt: true,
      claimedBy: { select: { doctorProfile: { select: { status: true } } } }
    }
  });

  if (!invitation || invitation.role !== "doctor") {
    throw new DoctorInviteError("INVALID_INVITATION");
  }
  if (invitation.revokedAt) {
    return { invitationId: invitation.id, unchanged: true, pendingDoctorRejected: false };
  }
  if (invitation.claimedById && invitation.claimedBy?.doctorProfile?.status !== "pending_review") {
    throw new DoctorInviteError("INVITATION_USED");
  }

  const revoked = await tx.doctorInvitation.updateMany({
    where: { id: invitation.id, revokedAt: null },
    data: { revokedAt: now, revokedById: input.actorId }
  });
  if (revoked.count !== 1) {
    throw new DoctorInviteError("INVITATION_STATE_INVALID");
  }

  const rejected = invitation.claimedById
    ? await tx.doctor.updateMany({
        where: { userId: invitation.claimedById, status: "pending_review" },
        data: { status: "rejected" }
      })
    : { count: 0 };

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: "doctor_invitation.revoke",
    entityType: "doctor_invitation",
    entityId: invitation.id,
    metadata: {
      role: "doctor",
      status: "revoked",
      revokedAt: now.toISOString()
    }
  });

  return {
    invitationId: invitation.id,
    unchanged: false,
    pendingDoctorRejected: rejected.count === 1
  };
}

export async function exchangeDoctorInviteToken(rawToken: string, now = new Date()) {
  const parsed = parseInviteToken(rawToken);
  if (!parsed) throw new DoctorInviteError("INVALID_INVITATION");

  const invitation = await prisma.doctorInvitation.findUnique({
    where: { id: parsed.invitationId },
    select: {
      id: true,
      role: true,
      tokenHash: true,
      expiresAt: true,
      claimedAt: true,
      claimedById: true,
      revokedAt: true
    }
  });

  if (!invitation || invitation.role !== "doctor" || !hashesMatch(invitation.tokenHash, tokenHash(rawToken))) {
    throw new DoctorInviteError("INVALID_INVITATION");
  }
  if (invitation.revokedAt) throw new DoctorInviteError("INVITATION_REVOKED");
  if (invitation.claimedAt || invitation.claimedById) throw new DoctorInviteError("INVITATION_USED");
  if (invitation.expiresAt <= now) throw new DoctorInviteError("INVITATION_EXPIRED");

  const expiresAt = new Date(
    Math.min(invitation.expiresAt.getTime(), now.getTime() + doctorInviteLimits.cookieTicketTtlMs)
  );
  return { ticket: createCookieTicket(invitation.id, expiresAt), expiresAt };
}

export async function inspectDoctorInviteTicket(
  ticket: string,
  userId?: string,
  now = new Date()
): Promise<DoctorInviteSafeContext> {
  const parsed = parseAndVerifyCookieTicket(ticket, now);
  const invitation = await prisma.doctorInvitation.findUnique({
    where: { id: parsed.invitationId },
    select: {
      id: true,
      role: true,
      expiresAt: true,
      claimedAt: true,
      revokedAt: true,
      claimedById: true,
      claimedBy: { select: { doctorProfile: { select: { status: true } } } }
    }
  });

  if (!invitation || invitation.role !== "doctor") {
    throw new DoctorInviteError("INVALID_INVITATION");
  }
  const state = safeInviteState(invitation, userId, now);
  return {
    invitationId: invitation.id,
    state,
    expiresAt: invitation.expiresAt,
    claimedAt: invitation.claimedAt,
    canClaim: state === "active"
  };
}

export async function claimDoctorInvitation(
  tx: Prisma.TransactionClient,
  input: { userId: string; ticket: string; now?: Date }
) {
  const now = input.now ?? new Date();
  const parsedTicket = parseAndVerifyCookieTicket(input.ticket, now);

  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`User\` WHERE \`id\` = ${input.userId} FOR UPDATE`
  );
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`DoctorInvitation\` WHERE \`id\` = ${parsedTicket.invitationId} FOR UPDATE`
  );

  const [user, invitation] = await Promise.all([
    tx.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        lineUserId: true,
        role: true,
        status: true,
        doctorProfile: { select: { status: true } },
        pharmacistProfile: { select: { status: true } }
      }
    }),
    tx.doctorInvitation.findUnique({
      where: { id: parsedTicket.invitationId },
      select: {
        id: true,
        role: true,
        expiresAt: true,
        claimedAt: true,
        claimedById: true,
        revokedAt: true
      }
    })
  ]);

  if (!invitation || invitation.role !== "doctor") {
    throw new DoctorInviteError("INVALID_INVITATION");
  }
  if (invitation.revokedAt) throw new DoctorInviteError("INVITATION_REVOKED");
  if (invitation.claimedAt || invitation.claimedById) {
    if (
      invitation.claimedById === input.userId &&
      user?.role === "customer" &&
      user.status === "active" &&
      user.doctorProfile?.status === "pending_review"
    ) {
      return { invitationId: invitation.id, status: "pending_review" as const, unchanged: true };
    }
    throw new DoctorInviteError("INVITATION_USED");
  }
  if (invitation.expiresAt <= now) throw new DoctorInviteError("INVITATION_EXPIRED");

  if (!user || user.role !== "customer" || user.status !== "active" || !user.lineUserId.trim()) {
    throw new DoctorInviteError("CLAIMANT_NOT_ELIGIBLE");
  }
  if (
    user.pharmacistProfile &&
    user.pharmacistProfile.status !== "rejected" &&
    user.pharmacistProfile.status !== "archived"
  ) {
    throw new DoctorInviteError("CONFLICTING_STAFF_PROFILE");
  }
  if (
    user.doctorProfile &&
    user.doctorProfile.status !== "pending_review" &&
    user.doctorProfile.status !== "rejected" &&
    user.doctorProfile.status !== "archived"
  ) {
    throw new DoctorInviteError("CLAIMANT_NOT_ELIGIBLE");
  }

  const claimed = await tx.doctorInvitation.updateMany({
    where: {
      id: invitation.id,
      claimedAt: null,
      claimedById: null,
      revokedAt: null,
      expiresAt: { gt: now }
    },
    data: { claimedAt: now, claimedById: input.userId }
  });
  if (claimed.count !== 1) throw new DoctorInviteError("INVITATION_USED");

  await tx.doctor.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId, status: "pending_review" },
    update: { status: "pending_review", approvedAt: null }
  });

  await writeAuditLog(tx, {
    actorId: input.userId,
    action: "doctor_invitation.claim",
    entityType: "doctor_invitation",
    entityId: invitation.id,
    metadata: { role: "doctor", status: "pending_review", claimedAt: now.toISOString() }
  });

  return { invitationId: invitation.id, status: "pending_review" as const, unchanged: false };
}
