import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    ZOOM_ACCOUNT_ID: "account-id",
    ZOOM_CLIENT_ID: "client-id",
    ZOOM_CLIENT_SECRET: "client-secret",
    ZOOM_HOST_USER_ID: "host@example.com"
  },
  fetch: vi.fn()
}));

vi.mock("@/lib/env/schema", () => ({
  getAppEnv: () => mocks.env
}));

import {
  createZoomMeetingIfConfigured,
  getZoomHostZakIfConfigured,
  isZoomMeetingCreationConfigured
} from "@/lib/zoom/meetings";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("Zoom Server-to-Server meeting integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.ZOOM_ACCOUNT_ID = "account-id";
    mocks.env.ZOOM_CLIENT_ID = "client-id";
    mocks.env.ZOOM_CLIENT_SECRET = "client-secret";
    mocks.env.ZOOM_HOST_USER_ID = "host@example.com";
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("does not make a request when owner credentials are incomplete", async () => {
    mocks.env.ZOOM_HOST_USER_ID = "";

    await expect(createZoomMeetingIfConfigured({ consultationId: "consultation-1", scheduledAt: null })).resolves.toBeNull();
    await expect(getZoomHostZakIfConfigured()).resolves.toBeNull();
    expect(isZoomMeetingCreationConfigured()).toBe(false);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("uses account credentials transiently to create a protected host meeting", async () => {
    mocks.fetch
      .mockResolvedValueOnce(jsonResponse({ access_token: "transient-access-token" }))
      .mockResolvedValueOnce(jsonResponse({ id: 12345678901, password: "meeting-passcode", join_url: "https://zoom.us/j/123" }));

    const meeting = await createZoomMeetingIfConfigured({
      consultationId: "consultation-123456",
      scheduledAt: new Date("2030-01-01T10:00:00.000Z")
    });

    expect(meeting).toEqual({
      meetingId: "12345678901",
      password: "meeting-passcode",
      joinUrl: "https://zoom.us/j/123"
    });
    expect(mocks.fetch.mock.calls[0]?.[0].toString()).toContain("grant_type=account_credentials");
    expect(mocks.fetch.mock.calls[1]?.[0]).toBe("https://api.zoom.us/v2/users/host%40example.com/meetings");
    expect(JSON.parse(mocks.fetch.mock.calls[1]?.[1].body)).toMatchObject({
      type: 2,
      settings: { join_before_host: false, waiting_room: true, mute_upon_entry: true }
    });
    expect(JSON.stringify(meeting)).not.toContain("transient-access-token");
  });

  it("fails without logging or returning OAuth secrets when OAuth fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.fetch.mockResolvedValueOnce(jsonResponse({ error: "invalid_client", secret: "client-secret" }, 401));

    await expect(createZoomMeetingIfConfigured({ consultationId: "consultation-1", scheduledAt: null })).rejects.toThrow(
      "Zoom access token request failed."
    );

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("fails safely when Zoom rejects meeting creation", async () => {
    mocks.fetch
      .mockResolvedValueOnce(jsonResponse({ access_token: "transient-access-token" }))
      .mockResolvedValueOnce(jsonResponse({ message: "invalid meeting" }, 400));

    await expect(createZoomMeetingIfConfigured({ consultationId: "consultation-1", scheduledAt: null })).rejects.toThrow(
      "Zoom meeting creation failed."
    );
  });

  it("gets a host ZAK only for the server-authorized host path", async () => {
    mocks.fetch
      .mockResolvedValueOnce(jsonResponse({ access_token: "transient-access-token" }))
      .mockResolvedValueOnce(jsonResponse({ token: "short-lived-zak" }));

    await expect(getZoomHostZakIfConfigured()).resolves.toBe("short-lived-zak");
    expect(mocks.fetch.mock.calls[1]?.[0]).toBe("https://api.zoom.us/v2/users/host%40example.com/token?type=zak");
  });
});
