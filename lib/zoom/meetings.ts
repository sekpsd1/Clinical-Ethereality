import { getAppEnv } from "@/lib/env/schema";

export type CreatedZoomMeeting = {
  meetingId: string;
  password: string;
  joinUrl: string;
};

type ZoomAccessTokenResponse = {
  access_token?: unknown;
};

type ZoomMeetingResponse = {
  id?: unknown;
  password?: unknown;
  join_url?: unknown;
};

type ZoomZakResponse = {
  token?: unknown;
};

type ZoomServerToServerCredentials = {
  accountId: string;
  clientId: string;
  clientSecret: string;
  hostUserId: string;
};

function getServerToServerCredentials(): ZoomServerToServerCredentials | null {
  const env = getAppEnv();

  if (!env.ZOOM_ACCOUNT_ID || !env.ZOOM_CLIENT_ID || !env.ZOOM_CLIENT_SECRET || !env.ZOOM_HOST_USER_ID) {
    return null;
  }

  return {
    accountId: env.ZOOM_ACCOUNT_ID,
    clientId: env.ZOOM_CLIENT_ID,
    clientSecret: env.ZOOM_CLIENT_SECRET,
    hostUserId: env.ZOOM_HOST_USER_ID
  };
}

async function requestZoomAccessToken(credentials: ZoomServerToServerCredentials): Promise<string> {
  const tokenUrl = new URL("https://zoom.us/oauth/token");
  tokenUrl.searchParams.set("grant_type", "account_credentials");
  tokenUrl.searchParams.set("account_id", credentials.accountId);

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`, "utf8").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000)
  });

  if (!tokenResponse.ok) {
    throw new Error("Zoom access token request failed.");
  }

  const tokenBody = (await tokenResponse.json()) as ZoomAccessTokenResponse;

  if (typeof tokenBody.access_token !== "string" || tokenBody.access_token.length === 0) {
    throw new Error("Zoom access token response is invalid.");
  }

  return tokenBody.access_token;
}

export function isZoomMeetingCreationConfigured(): boolean {
  return getServerToServerCredentials() !== null;
}

export async function createZoomMeetingIfConfigured(input: {
  consultationId: string;
  scheduledAt: Date | null;
}): Promise<CreatedZoomMeeting | null> {
  const credentials = getServerToServerCredentials();

  if (!credentials) {
    return null;
  }
  const accessToken = await requestZoomAccessToken(credentials);

  const startTime = input.scheduledAt && input.scheduledAt.getTime() > Date.now() ? input.scheduledAt : new Date();
  const meetingResponse = await fetch(
    `https://api.zoom.us/v2/users/${encodeURIComponent(credentials.hostUserId)}/meetings`,
    {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      topic: `Clinical consultation ${input.consultationId.slice(-6).toUpperCase()}`,
      type: 2,
      start_time: startTime.toISOString(),
      duration: 30,
      timezone: "Asia/Bangkok",
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: true
      }
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000)
    }
  );

  if (!meetingResponse.ok) {
    throw new Error("Zoom meeting creation failed.");
  }

  const meetingBody = (await meetingResponse.json()) as ZoomMeetingResponse;

  if (
    (typeof meetingBody.id !== "string" && typeof meetingBody.id !== "number") ||
    typeof meetingBody.join_url !== "string"
  ) {
    throw new Error("Zoom meeting response is invalid.");
  }

  return {
    meetingId: String(meetingBody.id),
    password: typeof meetingBody.password === "string" ? meetingBody.password : "",
    joinUrl: meetingBody.join_url
  };
}

export async function getZoomHostZakIfConfigured(): Promise<string | null> {
  const credentials = getServerToServerCredentials();

  if (!credentials) {
    return null;
  }

  const accessToken = await requestZoomAccessToken(credentials);
  const response = await fetch(
    `https://api.zoom.us/v2/users/${encodeURIComponent(credentials.hostUserId)}/token?type=zak`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000)
    }
  );

  if (!response.ok) {
    throw new Error("Zoom host authorization request failed.");
  }

  const body = (await response.json()) as ZoomZakResponse;

  if (typeof body.token !== "string" || body.token.length === 0) {
    throw new Error("Zoom host authorization response is invalid.");
  }

  return body.token;
}
