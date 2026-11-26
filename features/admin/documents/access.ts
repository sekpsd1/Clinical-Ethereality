import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export class AdminDocumentAccessError extends Error {
  constructor(public readonly status: 401 | 403 | 404) {
    super("Admin document unavailable");
  }
}

export const adminDocumentId = z.string().regex(/^[A-Za-z0-9_-]{1,191}$/);

export const privateDocumentHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Vary": "Cookie"
};

export async function authorizeAdminDocument() {
  const session = await getCurrentSession();
  if (!session) throw new AdminDocumentAccessError(401);
  if (session.role !== "admin" || session.userId.startsWith("dev:") || !session.sessionId) {
    throw new AdminDocumentAccessError(403);
  }

  const activeAdmin = await prisma.user.findFirst({
    where: {
      id: session.userId, role: "admin", status: "active",
      authSessions: { some: {
        id: session.sessionId, status: "active", revokedAt: null,
        expiresAt: { gt: new Date() }
      } }
    },
    select: { id: true }
  });
  if (!activeAdmin) throw new AdminDocumentAccessError(403);
}

export function adminDocumentError(error: unknown, message: string) {
  return Response.json({ message }, {
    status: error instanceof AdminDocumentAccessError ? error.status : 503,
    headers: privateDocumentHeaders
  });
}
