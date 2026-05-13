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

export type LineIdentity = {
  lineUserId: string;
  displayName?: string;
  pictureUrl?: string;
  email?: string;
};

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
