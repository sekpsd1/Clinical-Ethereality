import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import type { PublicSession } from "@/lib/auth/types";
import { getAppEnv } from "@/lib/env/schema";

const lifetimeMs = 45_000;
const scope = "receipt-jpg-download-v1";
const claimsSchema = z.object({
  resource: z.string(),
  userId: z.string(),
  sessionId: z.string(),
  expiresAt: z.number().int()
});

function ticketKey() {
  const secret = getAppEnv().JWT_SECRET;
  if (!secret) throw new Error("Receipt download signing is not configured.");
  return createHmac("sha256", secret).update(scope).digest();
}

export function issueReceiptDownloadTicket(session: PublicSession, resource: string): string {
  if (session.role !== "customer" || !session.sessionId) throw new Error("Receipt session unavailable.");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ticketKey(), nonce);
  const expiresAt = Math.min(Date.now() + lifetimeMs, Date.parse(session.expiresAt));
  const payload = JSON.stringify({ resource, userId: session.userId, sessionId: session.sessionId, expiresAt });
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function readReceiptDownloadTicket(ticket: string | null, resource: string): PublicSession | null {
  if (!ticket || !/^[A-Za-z0-9_-]{39,1024}$/.test(ticket)) return null;
  try {
    const bytes = Buffer.from(ticket, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", ticketKey(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const payload = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
    const claims = claimsSchema.parse(JSON.parse(payload));
    if (claims.resource !== resource || claims.expiresAt <= Date.now()) return null;
    return {
      userId: claims.userId,
      sessionId: claims.sessionId,
      role: "customer",
      lineUserId: "",
      expiresAt: new Date(claims.expiresAt).toISOString()
    };
  } catch {
    return null;
  }
}

export function redirectToReceiptAttachment(session: PublicSession, resource: string, headers: Record<string, string>) {
  const query = new URLSearchParams({
    format: "jpg",
    download: "1",
    ticket: issueReceiptDownloadTicket(session, resource)
  });
  // Use a relative location so reverse proxy host headers cannot forward the ticket off-site.
  const location = "?" + query.toString();
  return new Response(null, { status: 303, headers: { ...headers, Location: location } });
}
