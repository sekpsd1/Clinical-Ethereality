import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/audit-log";
import {
  findAuthorizedRecordingWithClient,
  type AuthorizedRecording,
  type RecordingViewer
} from "@/features/consultations/recordings/access";

export type RecordingAccessMode = "view" | "download";

const HANDOFF_VERSION = "v1";
const HANDOFF_SECRET_BYTES = 32;
const HANDOFF_TTL_MS = 2 * 60 * 1000;
const EXTERNAL_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const TOKEN_PATTERN = /^v1\.([0-9a-f-]{36})\.([A-Za-z0-9_-]{40,64})$/;
const MARKER_PATTERN = /^(recording-handoff-ticket|recording-external-session):v1:(admin|doctor):([a-f0-9]{64})(?::(pending|audited))?$/;

type HandoffMarker = {
  stage: "ticket" | "session";
  role: "admin" | "doctor";
  scopeHash: string;
  auditState: "pending" | "audited" | null;
};

type ParsedToken = {
  sessionId: string;
};

export type RecordingExternalAccess = {
  sessionId: string;
  tokenHash: string;
  marker: string;
  expiresAt: Date;
  auditState: "pending" | "audited";
  viewer: RecordingViewer & { role: "admin" | "doctor" };
  recording: AuthorizedRecording;
  mode: RecordingAccessMode;
};

export type RecordingExternalAuditResult = "audited" | "already_audited" | "invalid";

export class RecordingExternalHandoffError extends Error {
  constructor(message = "Recording access is invalid, expired, or unavailable.") {
    super(message);
    this.name = "RecordingExternalHandoffError";
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(`recording-external\0${token}`, "utf8").digest("hex");
}

function createScopeHash(
  consultationId: string,
  recordingId: string,
  mode: RecordingAccessMode
): string {
  return createHash("sha256")
    .update(`recording-scope\0${consultationId}\0${recordingId}\0${mode}`, "utf8")
    .digest("hex");
}

function hashesMatch(expected: string | null, actual: string): boolean {
  if (!expected || expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(actual, "utf8"));
}

function createOpaqueToken(sessionId: string): string {
  return `${HANDOFF_VERSION}.${sessionId}.${randomBytes(HANDOFF_SECRET_BYTES).toString("base64url")}`;
}

function parseOpaqueToken(token: string): ParsedToken | null {
  if (token.length > 160) return null;
  const match = TOKEN_PATTERN.exec(token);
  return match ? { sessionId: match[1] } : null;
}

function createMarker(
  stage: HandoffMarker["stage"],
  role: HandoffMarker["role"],
  scopeHash: string,
  auditState: HandoffMarker["auditState"] = null
): string {
  const prefix = stage === "ticket" ? "recording-handoff-ticket" : "recording-external-session";
  return `${prefix}:${HANDOFF_VERSION}:${role}:${scopeHash}${stage === "session" ? `:${auditState ?? "pending"}` : ""}`;
}

function parseMarker(value: string | null): HandoffMarker | null {
  if (!value || value.length > 191) return null;
  const match = MARKER_PATTERN.exec(value);
  if (!match) return null;

  const stage = match[1] === "recording-handoff-ticket" ? "ticket" : "session";
  const auditState = (match[4] as HandoffMarker["auditState"]) ?? null;
  if ((stage === "ticket" && auditState) || (stage === "session" && !auditState)) return null;

  return {
    stage,
    role: match[2] as HandoffMarker["role"],
    scopeHash: match[3],
    auditState
  };
}

function toViewer(user: { id: string; role: string; status: string }): RecordingExternalAccess["viewer"] | null {
  if (user.status !== "active" || (user.role !== "admin" && user.role !== "doctor")) return null;
  return { userId: user.id, role: user.role };
}

export function getRecordingExternalCookieName(mode: RecordingAccessMode): string {
  return mode === "download" ? "ce_recording_download_access" : "ce_recording_view_access";
}

export function getRecordingExternalCookiePath(consultationId: string, recordingId: string): string {
  return `/api/consultations/${encodeURIComponent(consultationId)}/recordings/${encodeURIComponent(recordingId)}`;
}

export function getRecordingExternalCookieOptions(
  consultationId: string,
  recordingId: string,
  maxAge = Math.floor(EXTERNAL_SESSION_TTL_MS / 1000)
) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: getRecordingExternalCookiePath(consultationId, recordingId),
    maxAge
  };
}

export async function issueRecordingExternalHandoff(
  consultationId: string,
  recordingId: string,
  mode: RecordingAccessMode,
  options: { now?: Date; ipAddress?: string | null } = {}
) {
  const now = options.now ?? new Date();
  const session = await getCurrentSession();

  if (
    !session ||
    session.userId.startsWith("dev:") ||
    (session.role !== "admin" && session.role !== "doctor")
  ) {
    throw new RecordingExternalHandoffError();
  }

  const viewer: RecordingExternalAccess["viewer"] = {
    userId: session.userId,
    role: session.role
  };
  const ticketSessionId = randomUUID();
  const ticket = createOpaqueToken(ticketSessionId);
  const expiresAt = new Date(now.getTime() + HANDOFF_TTL_MS);
  const scopeHash = createScopeHash(consultationId, recordingId, mode);

  const recording = await prisma.$transaction(async (tx) => {
    const authorized = await findAuthorizedRecordingWithClient(
      tx,
      viewer,
      consultationId,
      recordingId
    );
    if (!authorized) throw new RecordingExternalHandoffError();

    await tx.authSession.create({
      data: {
        id: ticketSessionId,
        userId: viewer.userId,
        refreshTokenHash: hashToken(ticket),
        status: "active",
        userAgent: createMarker("ticket", viewer.role, scopeHash),
        ipAddress: options.ipAddress ?? undefined,
        expiresAt
      }
    });

    await writeAuditLog(tx, {
      actorId: viewer.userId,
      action: "consultation_recording.handoff_issued",
      entityType: "consultation_recording",
      entityId: authorized.id,
      metadata: { role: viewer.role, mode, expiresAt: expiresAt.toISOString() }
    });

    return authorized;
  });

  return { ticket, consultationId: recording.consultationId, recordingId: recording.id, mode, expiresAt };
}

export async function exchangeRecordingExternalHandoff(
  ticket: string,
  consultationId: string,
  recordingId: string,
  mode: RecordingAccessMode,
  now = new Date()
) {
  const parsed = parseOpaqueToken(ticket);
  if (!parsed) throw new RecordingExternalHandoffError();

  const expectedScopeHash = createScopeHash(consultationId, recordingId, mode);
  const externalSessionToken = createOpaqueToken(parsed.sessionId);
  const externalSessionExpiresAt = new Date(now.getTime() + EXTERNAL_SESSION_TTL_MS);

  return prisma.$transaction(async (tx) => {
    const ticketRecord = await tx.authSession.findUnique({
      where: { id: parsed.sessionId },
      include: { user: { select: { id: true, role: true, status: true } } }
    });
    const marker = parseMarker(ticketRecord?.userAgent ?? null);
    const viewer = ticketRecord ? toViewer(ticketRecord.user) : null;

    if (
      !ticketRecord ||
      !marker ||
      marker.stage !== "ticket" ||
      marker.scopeHash !== expectedScopeHash ||
      !viewer ||
      viewer.role !== marker.role ||
      ticketRecord.userId !== viewer.userId ||
      ticketRecord.status !== "active" ||
      ticketRecord.expiresAt <= now ||
      !hashesMatch(ticketRecord.refreshTokenHash, hashToken(ticket))
    ) {
      throw new RecordingExternalHandoffError();
    }

    const recording = await findAuthorizedRecordingWithClient(
      tx,
      viewer,
      consultationId,
      recordingId
    );
    if (!recording) throw new RecordingExternalHandoffError();

    const sessionMarker = createMarker("session", viewer.role, expectedScopeHash, "pending");
    const consumed = await tx.authSession.updateMany({
      where: {
        id: ticketRecord.id,
        userId: viewer.userId,
        refreshTokenHash: ticketRecord.refreshTokenHash,
        status: "active",
        userAgent: ticketRecord.userAgent,
        expiresAt: { gt: now },
        user: { is: { id: viewer.userId, role: viewer.role, status: "active" } }
      },
      data: {
        refreshTokenHash: hashToken(externalSessionToken),
        userAgent: sessionMarker,
        expiresAt: externalSessionExpiresAt
      }
    });
    if (consumed.count !== 1) throw new RecordingExternalHandoffError();

    await writeAuditLog(tx, {
      actorId: viewer.userId,
      action: "consultation_recording.handoff_consumed",
      entityType: "consultation_recording",
      entityId: recording.id,
      metadata: { role: viewer.role, mode, expiresAt: externalSessionExpiresAt.toISOString() }
    });

    return {
      externalSessionToken,
      consultationId: recording.consultationId,
      recordingId: recording.id,
      mode,
      expiresAt: externalSessionExpiresAt
    };
  });
}

export async function getRecordingExternalAccess(
  consultationId: string,
  recordingId: string,
  mode: RecordingAccessMode,
  now = new Date()
): Promise<RecordingExternalAccess | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getRecordingExternalCookieName(mode))?.value;
  const parsed = token ? parseOpaqueToken(token) : null;
  if (!token || !parsed) return null;

  const tokenHash = hashToken(token);
  const expectedScopeHash = createScopeHash(consultationId, recordingId, mode);

  return prisma.$transaction(async (tx) => {
    const sessionRecord = await tx.authSession.findUnique({
      where: { id: parsed.sessionId },
      include: { user: { select: { id: true, role: true, status: true } } }
    });
    const marker = parseMarker(sessionRecord?.userAgent ?? null);
    const viewer = sessionRecord ? toViewer(sessionRecord.user) : null;

    if (
      !sessionRecord ||
      !marker ||
      marker.stage !== "session" ||
      marker.scopeHash !== expectedScopeHash ||
      !marker.auditState ||
      !viewer ||
      viewer.role !== marker.role ||
      sessionRecord.userId !== viewer.userId ||
      sessionRecord.status !== "active" ||
      sessionRecord.expiresAt <= now ||
      !hashesMatch(sessionRecord.refreshTokenHash, tokenHash)
    ) {
      return null;
    }

    const recording = await findAuthorizedRecordingWithClient(
      tx,
      viewer,
      consultationId,
      recordingId
    );
    if (!recording) return null;

    return {
      sessionId: sessionRecord.id,
      tokenHash,
      marker: sessionRecord.userAgent ?? "",
      expiresAt: sessionRecord.expiresAt,
      auditState: marker.auditState,
      viewer,
      recording,
      mode
    };
  });
}

export async function auditExternalRecordingAccessOnce(
  access: RecordingExternalAccess,
  now = new Date()
): Promise<RecordingExternalAuditResult> {
  const auditedMarker = access.auditState === "pending"
    ? access.marker.replace(/:pending$/, ":audited")
    : access.marker;
  if (!auditedMarker.endsWith(":audited")) return "invalid";

  if (access.auditState === "pending") {
    const claimResult = await prisma.$transaction(async (tx) => {
      const recording = await findAuthorizedRecordingWithClient(
        tx,
        access.viewer,
        access.recording.consultationId,
        access.recording.id
      );
      if (!recording) return "invalid" as const;

      const claimed = await tx.authSession.updateMany({
        where: {
          id: access.sessionId,
          userId: access.viewer.userId,
          refreshTokenHash: access.tokenHash,
          status: "active",
          userAgent: access.marker,
          expiresAt: { gt: now },
          user: { is: { id: access.viewer.userId, role: access.viewer.role, status: "active" } }
        },
        data: { userAgent: auditedMarker }
      });
      if (claimed.count !== 1) return "cas_missed" as const;

      await writeAuditLog(tx, {
        actorId: access.viewer.userId,
        action: access.mode === "download" ? "consultation_recording.download" : "consultation_recording.view",
        entityType: "consultation_recording",
        entityId: recording.id,
        metadata: {
          consultationId: recording.consultationId,
          provider: recording.provider,
          mode: access.mode,
          externalSession: true
        }
      });

      return "audited" as const;
    });

    if (claimResult !== "cas_missed") return claimResult;
  }

  return prisma.$transaction(async (tx) => {
    const sessionRecord = await tx.authSession.findUnique({
      where: { id: access.sessionId },
      include: { user: { select: { id: true, role: true, status: true } } }
    });
    const viewer = sessionRecord ? toViewer(sessionRecord.user) : null;

    if (
      !sessionRecord ||
      !viewer ||
      viewer.userId !== access.viewer.userId ||
      viewer.role !== access.viewer.role ||
      sessionRecord.userId !== access.viewer.userId ||
      sessionRecord.status !== "active" ||
      sessionRecord.expiresAt <= now ||
      sessionRecord.userAgent !== auditedMarker ||
      !hashesMatch(sessionRecord.refreshTokenHash, access.tokenHash)
    ) {
      return "invalid";
    }

    const recording = await findAuthorizedRecordingWithClient(
      tx,
      access.viewer,
      access.recording.consultationId,
      access.recording.id
    );
    return recording ? "already_audited" : "invalid";
  });
}

export const recordingExternalHandoffLimits = {
  handoffTtlMs: HANDOFF_TTL_MS,
  externalSessionTtlMs: EXTERNAL_SESSION_TTL_MS
} as const;
