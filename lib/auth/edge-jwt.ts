import type { Role } from "@/lib/permissions/roles";

type EdgeSessionClaims = {
  userId: string;
  lineUserId: string;
  role: Role;
  tokenType: "access" | "refresh";
  iss: string;
  sub: string;
  iat: number;
  exp: number;
  sessionId?: string;
};

const encoder = new TextEncoder();
const roles = ["customer", "doctor", "pharmacist", "admin"] as const;

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function decodeJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}

function assertEdgeClaims(value: unknown): EdgeSessionClaims {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid session token payload.");
  }

  const claims = value as Partial<EdgeSessionClaims>;

  if (
    typeof claims.userId !== "string" ||
    typeof claims.lineUserId !== "string" ||
    typeof claims.sub !== "string" ||
    typeof claims.iss !== "string" ||
    typeof claims.iat !== "number" ||
    typeof claims.exp !== "number" ||
    claims.tokenType !== "access" ||
    !isRole(claims.role)
  ) {
    throw new Error("Invalid session token claims.");
  }

  return claims as EdgeSessionClaims;
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "verify"
  ]);
}

export async function verifyAccessTokenAtEdge(token: string): Promise<EdgeSessionClaims> {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtIssuer = process.env.JWT_ISSUER ?? "clinical-ethereality";

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required to protect routes.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Invalid session token format.");
  }

  const header = decodeJson<{ alg?: string; typ?: string }>(encodedHeader);

  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new Error("Invalid session token header.");
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await importSigningKey(jwtSecret),
    toArrayBuffer(decodeBase64Url(encodedSignature)),
    encoder.encode(signingInput)
  );

  if (!valid) {
    throw new Error("Invalid session token signature.");
  }

  const claims = assertEdgeClaims(decodeJson(encodedPayload));
  const now = Math.floor(Date.now() / 1000);

  if (claims.iss !== jwtIssuer || claims.exp <= now) {
    throw new Error("Session token is expired or not valid for this app.");
  }

  return claims;
}
