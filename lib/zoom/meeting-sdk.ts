import { getAppEnv } from "@/lib/env/schema";

const encoder = new TextEncoder();

function encodeBase64Url(value: string | Uint8Array): string {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);

  return buffer.toString("base64url");
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign"
  ]);
}

export function isZoomMeetingSdkConfigured(): boolean {
  const env = getAppEnv();

  return Boolean(env.ZOOM_MEETING_SDK_CLIENT_ID && env.ZOOM_MEETING_SDK_CLIENT_SECRET);
}

export async function issueZoomMeetingSdkSignature(meetingNumber: string, role: 0 | 1 = 0): Promise<string | null> {
  const env = getAppEnv();

  if (!env.ZOOM_MEETING_SDK_CLIENT_ID || !env.ZOOM_MEETING_SDK_CLIENT_SECRET) {
    return null;
  }

  if (!/^\d{9,12}$/.test(meetingNumber)) {
    throw new Error("Zoom meeting number is invalid.");
  }

  const now = Math.floor(Date.now() / 1000);
  const issuedAt = now;
  // Zoom requires at least 30 minutes between iat and exp/tokenExp. Keep the
  // credential at that minimum rather than issuing the previous two-hour token.
  const expiresAt = issuedAt + 30 * 60;
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const payload = {
    appKey: env.ZOOM_MEETING_SDK_CLIENT_ID,
    mn: meetingNumber,
    role,
    iat: issuedAt,
    exp: expiresAt,
    tokenExp: expiresAt,
    video_webrtc_mode: 1
  };
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await importSigningKey(env.ZOOM_MEETING_SDK_CLIENT_SECRET);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput));

  return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
}
