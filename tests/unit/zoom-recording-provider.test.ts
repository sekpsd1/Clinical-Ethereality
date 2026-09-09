import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: { ENABLE_ZOOM_CLOUD_RECORDING: false },
  token: vi.fn(),
  fetch: vi.fn()
}));
vi.mock("@/lib/env/schema", () => ({ getAppEnv: () => mocks.env }));
vi.mock("@/lib/zoom/meetings", () => ({ getZoomServerAccessTokenIfConfigured: mocks.token }));

import { zoomRecordingContentProvider } from "@/features/consultations/recordings/provider";

const recording = {
  id: "recording-1",
  consultationId: "consultation-1",
  provider: "zoom" as const,
  providerRecordingId: "provider-file-1",
  fileType: "mp4",
  recordingType: "speaker_view",
  zoomMeetingId: "12345678901"
};

describe("feature-flagged Zoom recording provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = false;
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("fails closed without token or provider requests while the flag is off", async () => {
    await expect(zoomRecordingContentProvider.open(recording)).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    expect(mocks.token).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
