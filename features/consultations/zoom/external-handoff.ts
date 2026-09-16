import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getAppEnv } from "@/lib/env/schema";
import {
  buildZoomConsultationAccessWhere,
  type ZoomConsultationViewer
} from "@/features/consultations/zoom/access";

const HANDOFF_VERSION = "v1";
const HANDOFF_SECRET_BYTES = 32;
const HANDOFF_TTL_MS = 2 * 60 * 1000;
const EXTERNAL_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const TOKEN_PATTERN = /^v1\.([0-9a-f-]{36})\.([A-Za-z0-9_-]{40,64})$/;
const IDEMPOTENCY_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MARKER_PATTERN = /^(zoom-handoff-ticket|zoom-external-session):v1:(customer|doctor):([A-Za-z0-9_-]{8,191})$/;
const developmentHandoffSecret = randomBytes(HANDOFF_SECRET_BYTES);

export const zoomExternalAccessCookieName = "ce_zoom_access";

type HandoffMarker = {
  stage: "ticket" | "session";
  role: ZoomConsultationViewer["role"];
  consultationId: string;
};

type ParsedToken = {
  sessionId: string;
};

export class ZoomExternalHandoffError extends Error {
  constructor(message = "Zoom external handoff is invalid, expired, or unavailable.") {
    super(message);
    this.name = "ZoomExternalHandoffError";
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(`zoom-external\0${token}`, "utf8").digest("hex");
}

function hashesMatch(expected: string | null, actual: string): boolean {
  if (!expected || expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(actual, "utf8"));
}

function createOpaqueToken(sessionId: string): string {
  return `${HANDOFF_VERSION}.${sessionId}.${randomBytes(HANDOFF_SECRET_BYTES).toString("base64url")}`;
}

function createIdempotentHandoffToken(
  sessionId: string,
  viewer: ZoomConsultationViewer,
  consultationId: string
): string {
  const configuredSecret = getAppEnv().JWT_SECRET;
  const secret = configuredSecret
    ? Buffer.from(configuredSecret, "utf8")
    : developmentHandoffSecret;
  const digest = createHmac("sha256", secret)
    .update(
      `zoom-handoff\0${sessionId}\0${viewer.userId}\0${viewer.role}\0${consultationId}`,
      "utf8"
    )
    .digest("base64url");

  return `${HANDOFF_VERSION}.${sessionId}.${digest}`;
}

function parseOpaqueToken(token: string): ParsedToken | null {
  if (token.length > 160) {
    return null;
  }

  const match = TOKEN_PATTERN.exec(token);

  return match ? { sessionId: match[1] } : null;
}

function createMarker(stage: HandoffMarker["stage"], role: HandoffMarker["role"], consultationId: string) {
  return `zoom-${stage === "ticket" ? "handoff-ticket" : "external-session"}:${HANDOFF_VERSION}:${role}:${consultationId}`;
}

function parseMarker(value: string | null): HandoffMarker | null {
  if (!value) {
    return null;
  }

  const match = MARKER_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  return {
    stage: match[1] === "zoom-handoff-ticket" ? "ticket" : "session",
    role: match[2] as HandoffMarker["role"],
    consultationId: match[3]
  };
}

function toViewer(user: {
  id: string;
  role: string;
  status: string;
  displayName: string | null;
}): ZoomConsultationViewer | null {
  if (user.status !== "active" || (user.role !== "customer" && user.role !== "doctor")) {
    return null;
  }

  return {
    userId: user.id,
    role: user.role,
    displayName: user.displayName
  };
}

export function getZoomExternalAccessCookieOptions(maxAge = Math.floor(EXTERNAL_SESSION_TTL_MS / 1000)) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/api",
    maxAge
  };
}

export async function issueZoomExternalHandoff(
  consultationId: string,
  options: {
    now?: Date;
    ipAddress?: string | null;
    idempotencyKey?: string | null;
  } = {}
) {
  const now = options.now ?? new Date();
  const session = await getCurrentSession();

  if (
    !session ||
    session.userId.startsWith("dev:") ||
    (session.role !== "customer" && session.role !== "doctor")
  ) {
    throw new ZoomExternalHandoffError();
  }

  const viewer: ZoomConsultationViewer = {
    userId: session.userId,
    role: session.role,
    displayName: session.displayName
  };
  const idempotencyKey = options.idempotencyKey?.trim();
  const ticketSessionId =
    idempotencyKey && IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)
      ? idempotencyKey.toLowerCase()
      : randomUUID();
  const ticket = idempotencyKey
    ? createIdempotentHandoffToken(ticketSessionId, viewer, consultationId)
    : createOpaqueToken(ticketSessionId);
  const expiresAt = new Date(now.getTime() + HANDOFF_TTL_MS);

  try {
    await prisma.$transaction(async (tx) => {
      const consultation = await tx.consultation.findFirst({
        where: buildZoomConsultationAccessWhere(viewer, consultationId, now),
        select: {
          id: true,
          zoomMeetingId: true
        }
      });

      if (!consultation?.zoomMeetingId) {
        throw new ZoomExternalHandoffError();
      }

      await tx.authSession.create({
        data: {
          id: ticketSessionId,
          userId: viewer.userId,
          refreshTokenHash: hashToken(ticket),
          status: "active",
          userAgent: createMarker("ticket", viewer.role, consultation.id),
          ipAddress: options.ipAddress ?? undefined,
          expiresAt
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: viewer.userId,
          action: "consultation.zoom_handoff_issued",
          entityType: "Consultation",
          entityId: consultation.id,
          metadataJson: {
            role: viewer.role,
            expiresAt: expiresAt.toISOString()
          }
        }
      });
    });
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002" ||
      !idempotencyKey
    ) {
      throw error;
    }

    const existing = await prisma.authSession.findUnique({
      where: { id: ticketSessionId },
      select: {
        userId: true,
        refreshTokenHash: true,
        status: true,
        userAgent: true,
        expiresAt: true
      }
    });
    const marker = parseMarker(existing?.userAgent ?? null);

    if (
      !existing ||
      !marker ||
      marker.stage !== "ticket" ||
      marker.role !== viewer.role ||
      marker.consultationId !== consultationId ||
      existing.userId !== viewer.userId ||
      existing.status !== "active" ||
      existing.expiresAt <= now ||
      !hashesMatch(existing.refreshTokenHash, hashToken(ticket))
    ) {
      throw new ZoomExternalHandoffError();
    }

    return {
      ticket,
      consultationId,
      expiresAt: existing.expiresAt
    };
  }

  return {
    ticket,
    consultationId,
    expiresAt
  };
}

export async function exchangeZoomExternalHandoff(ticket: string, now = new Date()) {
  const parsed = parseOpaqueToken(ticket);

  if (!parsed) {
    throw new ZoomExternalHandoffError();
  }

  const externalSessionToken = createOpaqueToken(parsed.sessionId);
  const externalSessionExpiresAt = new Date(now.getTime() + EXTERNAL_SESSION_TTL_MS);

  return prisma.$transaction(async (tx) => {
    const ticketRecord = await tx.authSession.findUnique({
      where: {
        id: parsed.sessionId
      },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            status: true,
            displayName: true
          }
        }
      }
    });
    const marker = parseMarker(ticketRecord?.userAgent ?? null);
    const viewer = ticketRecord ? toViewer(ticketRecord.user) : null;

    if (
      !ticketRecord ||
      !marker ||
      marker.stage !== "ticket" ||
      !viewer ||
      viewer.role !== marker.role ||
      ticketRecord.userId !== viewer.userId ||
      ticketRecord.status !== "active" ||
      ticketRecord.expiresAt <= now ||
      !hashesMatch(ticketRecord.refreshTokenHash, hashToken(ticket))
    ) {
      throw new ZoomExternalHandoffError();
    }

    const consultation = await tx.consultation.findFirst({
      where: buildZoomConsultationAccessWhere(viewer, marker.consultationId, now),
      select: {
        id: true,
        zoomMeetingId: true
      }
    });

    if (!consultation?.zoomMeetingId) {
      throw new ZoomExternalHandoffError();
    }

    const consumed = await tx.authSession.updateMany({
      where: {
        id: ticketRecord.id,
        userId: viewer.userId,
        refreshTokenHash: ticketRecord.refreshTokenHash,
        status: "active",
        userAgent: ticketRecord.userAgent,
        expiresAt: {
          gt: now
        },
        user: {
          is: {
            id: viewer.userId,
            role: viewer.role,
            status: "active"
          }
        }
      },
      data: {
        refreshTokenHash: hashToken(externalSessionToken),
        userAgent: createMarker("session", viewer.role, consultation.id),
        expiresAt: externalSessionExpiresAt
      }
    });

    if (consumed.count !== 1) {
      throw new ZoomExternalHandoffError();
    }

    await tx.auditLog.create({
      data: {
        actorId: viewer.userId,
        action: "consultation.zoom_handoff_consumed",
        entityType: "Consultation",
        entityId: consultation.id,
        metadataJson: {
          role: viewer.role,
          expiresAt: externalSessionExpiresAt.toISOString()
        }
      }
    });

    return {
      externalSessionToken,
      consultationId: consultation.id,
      role: viewer.role,
      expiresAt: externalSessionExpiresAt
    };
  });
}

export async function getZoomExternalViewer(
  consultationId: string,
  now = new Date()
): Promise<ZoomConsultationViewer | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(zoomExternalAccessCookieName)?.value;
  const parsed = token ? parseOpaqueToken(token) : null;

  if (!token || !parsed) {
    return null;
  }

  const sessionRecord = await prisma.authSession.findUnique({
    where: {
      id: parsed.sessionId
    },
    include: {
      user: {
        select: {
          id: true,
          role: true,
          status: true,
          displayName: true
        }
      }
    }
  });
  const marker = parseMarker(sessionRecord?.userAgent ?? null);
  const viewer = sessionRecord ? toViewer(sessionRecord.user) : null;

  if (
    !sessionRecord ||
    !marker ||
    marker.stage !== "session" ||
    marker.consultationId !== consultationId ||
    !viewer ||
    viewer.role !== marker.role ||
    sessionRecord.userId !== viewer.userId ||
    sessionRecord.status !== "active" ||
    sessionRecord.expiresAt <= now ||
    !hashesMatch(sessionRecord.refreshTokenHash, hashToken(token))
  ) {
    return null;
  }

  const consultation = await prisma.consultation.findFirst({
    where: buildZoomConsultationAccessWhere(viewer, consultationId, now),
    select: {
      id: true,
      zoomMeetingId: true
    }
  });

  if (!consultation?.zoomMeetingId) {
    return null;
  }

  return viewer;
}

export async function revokeCurrentZoomExternalSession(now = new Date()) {
  const cookieStore = await cookies();
  const token = cookieStore.get(zoomExternalAccessCookieName)?.value;
  const parsed = token ? parseOpaqueToken(token) : null;

  if (!token || !parsed) {
    return { revoked: false } as const;
  }

  return prisma.$transaction(async (tx) => {
    const sessionRecord = await tx.authSession.findUnique({
      where: {
        id: parsed.sessionId
      },
      include: {
        user: {
          select: {
            id: true,
            role: true
          }
        }
      }
    });
    const marker = parseMarker(sessionRecord?.userAgent ?? null);

    if (
      !sessionRecord ||
      !marker ||
      marker.stage !== "session" ||
      (sessionRecord.user.role !== "customer" && sessionRecord.user.role !== "doctor") ||
      sessionRecord.user.role !== marker.role ||
      sessionRecord.userId !== sessionRecord.user.id ||
      sessionRecord.status !== "active" ||
      sessionRecord.expiresAt <= now ||
      !hashesMatch(sessionRecord.refreshTokenHash, hashToken(token))
    ) {
      return { revoked: false } as const;
    }

    const revoked = await tx.authSession.updateMany({
      where: {
        id: sessionRecord.id,
        userId: sessionRecord.user.id,
        refreshTokenHash: sessionRecord.refreshTokenHash,
        status: "active",
        userAgent: sessionRecord.userAgent,
        expiresAt: {
          gt: now
        },
        user: {
          is: {
            id: sessionRecord.user.id,
            role: marker.role
          }
        }
      },
      data: {
        status: "revoked",
        revokedAt: now
      }
    });

    if (revoked.count !== 1) {
      return { revoked: false } as const;
    }

    await tx.auditLog.create({
      data: {
        actorId: sessionRecord.user.id,
        action: "consultation.zoom_external_session_revoked",
        entityType: "Consultation",
        entityId: marker.consultationId,
        metadataJson: {
          role: marker.role,
          reason: "browser_video_room_leave"
        }
      }
    });

    return {
      revoked: true,
      consultationId: marker.consultationId
    } as const;
  });
}

export const zoomExternalHandoffLimits = {
  handoffTtlMs: HANDOFF_TTL_MS,
  externalSessionTtlMs: EXTERNAL_SESSION_TTL_MS
} as const;
