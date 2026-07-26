import { z } from "zod";
import { getAppEnv } from "@/lib/env/schema";

const lineIdTokenResponseSchema = z.object({
  iss: z.string(),
  sub: z.string(),
  aud: z.string(),
  exp: z.number(),
  iat: z.number(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
  email: z.string().email().optional()
});

const lineTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  id_token: z.string().min(1)
});

const lineProfileResponseSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  pictureUrl: z.string().url().optional()
});

export type LineIdentity = {
  lineUserId: string;
  displayName?: string;
  pictureUrl?: string;
  email?: string;
};

async function getLineProfile(accessToken: string): Promise<LineIdentity> {
  const response = await fetch("https://api.line.me/v2/profile", {
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("LINE profile request failed.");
  }

  const profile = lineProfileResponseSchema.parse(await response.json());

  return {
    lineUserId: profile.userId,
    displayName: profile.displayName,
    pictureUrl: profile.pictureUrl
  };
}

export async function enrichLineIdentityWithProfile(
  identity: LineIdentity,
  accessToken: string
): Promise<LineIdentity> {
  const profile = await getLineProfile(accessToken);

  if (profile.lineUserId !== identity.lineUserId) {
    throw new Error("LINE profile does not match the verified ID token.");
  }

  return {
    ...identity,
    displayName: profile.displayName ?? identity.displayName,
    pictureUrl: profile.pictureUrl ?? identity.pictureUrl
  };
}

export async function verifyLineIdToken(idToken: string): Promise<LineIdentity> {
  const { LINE_CHANNEL_ID } = getAppEnv();

  if (!LINE_CHANNEL_ID) {
    throw new Error("LINE_CHANNEL_ID is required before verifying LINE LIFF logins.");
  }

  const body = new URLSearchParams({
    id_token: idToken,
    client_id: LINE_CHANNEL_ID
  });
  const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("LINE ID token verification failed.");
  }

  const result = lineIdTokenResponseSchema.parse(await response.json());

  if (result.aud !== LINE_CHANNEL_ID || result.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("LINE ID token is not valid for this app.");
  }

  return {
    lineUserId: result.sub,
    displayName: result.name,
    pictureUrl: result.picture,
    email: result.email
  };
}

export async function exchangeLineAuthorizationCode(code: string): Promise<LineIdentity> {
  const { LINE_CHANNEL_ID, LINE_CHANNEL_SECRET, LINE_LOGIN_CALLBACK_URL } = getAppEnv();

  if (!LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET || !LINE_LOGIN_CALLBACK_URL) {
    throw new Error("LINE Login server configuration is incomplete.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: LINE_LOGIN_CALLBACK_URL,
    client_id: LINE_CHANNEL_ID,
    client_secret: LINE_CHANNEL_SECRET
  });
  const response = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("LINE authorization code exchange failed.");
  }

  const result = lineTokenResponseSchema.parse(await response.json());
  const identity = await verifyLineIdToken(result.id_token);

  return enrichLineIdentityWithProfile(identity, result.access_token);
}
