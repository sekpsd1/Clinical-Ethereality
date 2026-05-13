import { getAppEnv } from "@/lib/env/schema";
import { isRole } from "@/lib/permissions/roles";
import type { AuthSession, SessionClaims, SessionTokenType } from "@/lib/auth/types";

type JwtHeader = {
  alg: "HS256";
  typ: "JWT";
};

const encoder = new TextEncoder();

function encodeBase64Url(value: string | Uint8Array): string {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);

  return buffer.toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function parseDurationSeconds(value: string): number {
  const match = value.match(/^(\d+)([smhd])$/);

  if (!match) {
    throw new Error(`Invalid JWT duration: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60
  };

  return amount * multipliers[unit];
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify"
  ]);
}

function getJwtSecret(): string {
  const { JWT_SECRET } = getAppEnv();

  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is required before issuing or validating sessions.");
  }

  return JWT_SECRET;
}

function assertClaims(value: unknown): SessionClaims {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid session token payload.");
  }

  const claims = value as Partial<SessionClaims>;

  if (
    typeof claims.userId !== "string" ||
    typeof claims.lineUserId !== "string" ||
    typeof claims.sub !== "string" ||
    typeof claims.iss !== "string" ||
    typeof claims.iat !== "number" ||
    typeof claims.exp !== "number" ||
    (claims.sessionId !== undefined && typeof claims.sessionId !== "string") ||
    (claims.tokenType !== "access" && claims.tokenType !== "refresh") ||
    !isRole(claims.role)
  ) {
    throw new Error("Invalid session token claims.");
  }

  return claims as SessionClaims;
}

export function getSessionTtlSeconds(tokenType: SessionTokenType): number {
  const env = getAppEnv();
  const ttl = tokenType === "access" ? env.JWT_ACCESS_TOKEN_TTL : env.JWT_REFRESH_TOKEN_TTL;

  return parseDurationSeconds(ttl);
}

export async function issueSessionToken(session: AuthSession, tokenType: SessionTokenType): Promise<string> {
  const env = getAppEnv();
  const now = Math.floor(Date.now() / 1000);
  const claims: SessionClaims = {
    ...session,
    tokenType,
    iss: env.JWT_ISSUER,
    sub: session.userId,
    iat: now,
    exp: now + getSessionTtlSeconds(tokenType)
  };
  const header: JwtHeader = {
    alg: "HS256",
    typ: "JWT"
  };
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await importSigningKey(getJwtSecret());
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput));

  return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string, tokenType: SessionTokenType): Promise<SessionClaims> {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Invalid session token format.");
  }

  const header = JSON.parse(decodeBase64Url(encodedHeader)) as Partial<JwtHeader>;

  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new Error("Invalid session token header.");
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await importSigningKey(getJwtSecret());
  const validSignature = await crypto.subtle.verify(
    "HMAC",
    key,
    Buffer.from(encodedSignature, "base64url"),
    encoder.encode(signingInput)
  );

  if (!validSignature) {
    throw new Error("Invalid session token signature.");
  }

  const claims = assertClaims(JSON.parse(decodeBase64Url(encodedPayload)));
  const env = getAppEnv();
  const now = Math.floor(Date.now() / 1000);

  if (claims.iss !== env.JWT_ISSUER || claims.tokenType !== tokenType || claims.exp <= now) {
    throw new Error("Session token is expired or not valid for this app.");
  }

  return claims;
}
