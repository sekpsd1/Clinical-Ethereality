import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    ZOOM_MEETING_SDK_CLIENT_ID: "meeting-sdk-client-id",
    ZOOM_MEETING_SDK_CLIENT_SECRET: "meeting-sdk-client-secret"
  }
}));

vi.mock("@/lib/env/schema", () => ({
  getAppEnv: () => mocks.env
}));

import { issueZoomMeetingSdkSignature, isZoomMeetingSdkConfigured } from "@/lib/zoom/meeting-sdk";

function decodePayload(signature: string) {
  return JSON.parse(Buffer.from(signature.split(".")[1]!, "base64url").toString("utf8")) as Record<string, unknown>;
}

describe("Zoom Meeting SDK signature", () => {
  beforeEach(() => {
    mocks.env.ZOOM_MEETING_SDK_CLIENT_ID = "meeting-sdk-client-id";
    mocks.env.ZOOM_MEETING_SDK_CLIENT_SECRET = "meeting-sdk-client-secret";
  });

  it("issues separate short-lived host and participant signatures without exposing the client secret", async () => {
    const doctorSignature = await issueZoomMeetingSdkSignature("12345678901", 1);
    const customerSignature = await issueZoomMeetingSdkSignature("12345678901", 0);

    expect(doctorSignature).toBeTruthy();
    expect(customerSignature).toBeTruthy();
    expect(decodePayload(doctorSignature!)).toMatchObject({ appKey: "meeting-sdk-client-id", mn: "12345678901", role: 1 });
    expect(decodePayload(customerSignature!)).toMatchObject({ appKey: "meeting-sdk-client-id", mn: "12345678901", role: 0 });
    const payload = decodePayload(doctorSignature!);
    expect(Number(payload.exp) - Number(payload.iat)).toBe(30 * 60);
    expect(doctorSignature).not.toContain("meeting-sdk-client-secret");
  });

  it("fails closed when Meeting SDK credentials are absent", async () => {
    mocks.env.ZOOM_MEETING_SDK_CLIENT_SECRET = "";

    await expect(issueZoomMeetingSdkSignature("12345678901", 0)).resolves.toBeNull();
    expect(isZoomMeetingSdkConfigured()).toBe(false);
  });
});
