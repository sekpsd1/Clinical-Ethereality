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

export function isZoomMeetingCreationConfigured(): boolean {
  const env = getAppEnv();

  return Boolean(env.ZOOM_ACCOUNT_ID && env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET);
}

export async function createZoomMeetingIfConfigured(input: {
  consultationId: string;
  scheduledAt: Date | null;
}): Promise<CreatedZoomMeeting | null> {
  const env = getAppEnv();

  if (!env.ZOOM_ACCOUNT_ID || !env.ZOOM_CLIENT_ID || !env.ZOOM_CLIENT_SECRET) {
    return null;
  }

  const tokenUrl = new URL("https://zoom.us/oauth/token");
  tokenUrl.searchParams.set("grant_type", "account_credentials");
  tokenUrl.searchParams.set("account_id", env.ZOOM_ACCOUNT_ID);

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`, "utf8").toString("base64")}`,
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

  const startTime = input.scheduledAt && input.scheduledAt.getTime() > Date.now() ? input.scheduledAt : new Date();
  const meetingResponse = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenBody.access_token}`,
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
        join_before_host: true,
        mute_upon_entry: true,
        waiting_room: false
      }
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000)
  });

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
