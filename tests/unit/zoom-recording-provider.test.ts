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
  recordingType: "shared_screen_with_speaker_view",
  zoomMeetingId: "12345678901",
  fileSizeBytes: BigInt(1024)
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

  it("forwards one byte range and accepts only safe partial-content headers", async () => {
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    mocks.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recording_files: [{
          id: "provider-file-1",
          download_url: "https://zoom.us/private/file",
          file_type: "MP4",
          recording_type: "shared_screen_with_speaker_view"
        }]
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response("partial", {
        status: 206,
        headers: {
          "content-type": "video/mp4",
          "content-length": "7",
          "content-range": "bytes 0-6/1024",
          "accept-ranges": "bytes"
        }
      }));

    const content = await zoomRecordingContentProvider.open(recording, { range: "bytes=0-6" });

    expect(mocks.fetch.mock.calls[1]?.[1]?.headers).toMatchObject({ Range: "bytes=0-6" });
    expect(content).toMatchObject({
      status: 206,
      contentLength: "7",
      contentRange: "bytes 0-6/1024",
      acceptRanges: "bytes"
    });
  });

  it("fails closed for provider 416 or malformed partial-content metadata", async () => {
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    const metadata = () => new Response(JSON.stringify({
      recording_files: [{
        id: "provider-file-1",
        download_url: "https://zoom.us/private/file",
        file_type: "MP4",
        recording_type: "shared_screen_with_speaker_view"
      }]
    }), { status: 200, headers: { "content-type": "application/json" } });
    mocks.fetch
      .mockResolvedValueOnce(metadata())
      .mockResolvedValueOnce(new Response(null, { status: 416 }));

    await expect(
      zoomRecordingContentProvider.open(recording, { range: "bytes=9999-" })
    ).rejects.toMatchObject({ code: "RANGE_NOT_SATISFIABLE" });

    mocks.fetch
      .mockResolvedValueOnce(metadata())
      .mockResolvedValueOnce(new Response("partial", {
        status: 206,
        headers: { "content-range": "unsafe", "content-length": "7" }
      }));
    await expect(
      zoomRecordingContentProvider.open(recording, { range: "bytes=0-6" })
    ).rejects.toMatchObject({ code: "CONTENT_UNAVAILABLE" });
  });

  it("rejects provider metadata or response MIME that is not the canonical MP4 recording", async () => {
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      recording_files: [{
        id: "provider-file-1",
        download_url: "https://zoom.us/private/file",
        file_type: "M4A",
        recording_type: "audio_only"
      }]
    }), { status: 200, headers: { "content-type": "application/json" } }));

    await expect(zoomRecordingContentProvider.open(recording)).rejects.toMatchObject({
      code: "METADATA_UNAVAILABLE"
    });
    expect(mocks.fetch).toHaveBeenCalledOnce();

    mocks.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recording_files: [{
          id: "provider-file-1",
          download_url: "https://zoom.us/private/file",
          file_type: "MP4",
          recording_type: "shared_screen_with_speaker_view"
        }]
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response("audio-bytes", {
        status: 200,
        headers: { "content-type": "audio/mp4" }
      }));

    await expect(zoomRecordingContentProvider.open(recording)).rejects.toMatchObject({
      code: "CONTENT_UNAVAILABLE"
    });
  });
});
