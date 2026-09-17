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

const chatRecording = {
  ...recording,
  id: "recording-chat-1",
  providerRecordingId: "provider-chat-1",
  fileType: "txt",
  recordingType: "chat_file",
  fileSizeBytes: BigInt(64)
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
          recording_type: "shared_screen_with_speaker_view",
          status: "completed"
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
        recording_type: "shared_screen_with_speaker_view",
        status: "completed"
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
          recording_type: "shared_screen_with_speaker_view",
          status: "completed"
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

  it("serves exact chat TXT metadata as non-executable UTF-8 text without range semantics", async () => {
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    mocks.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recording_files: [{
          id: "provider-chat-1",
          download_url: "https://zoom.us/private/chat",
          file_type: "TXT",
          recording_type: "chat_file",
          status: "completed"
        }]
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response("<script>alert('blocked')</script>", {
        status: 200,
        headers: {
          "content-type": "text/plain",
          "content-length": "34",
          "accept-ranges": "bytes"
        }
      }));

    const content = await zoomRecordingContentProvider.open(chatRecording);

    expect(mocks.fetch.mock.calls[1]?.[1]?.headers).not.toHaveProperty("Range");
    expect(content).toMatchObject({
      status: 200,
      contentType: "text/plain; charset=utf-8",
      contentLength: "34",
      contentRange: null,
      acceptRanges: null
    });
  });

  it("rejects ranges and provider pair/MIME mismatches for chat TXT", async () => {
    await expect(
      zoomRecordingContentProvider.open(chatRecording, { range: "bytes=0-6" })
    ).rejects.toMatchObject({ code: "RANGE_NOT_SATISFIABLE" });
    expect(mocks.fetch).not.toHaveBeenCalled();

    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      recording_files: [{
        id: "provider-chat-1",
        download_url: "https://zoom.us/private/chat",
        file_type: "MP4",
        recording_type: "shared_screen_with_speaker_view"
      }]
    }), { status: 200, headers: { "content-type": "application/json" } }));

    await expect(zoomRecordingContentProvider.open(chatRecording)).rejects.toMatchObject({
      code: "METADATA_UNAVAILABLE"
    });

    mocks.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recording_files: [{
          id: "provider-chat-1",
          download_url: "https://zoom.us/private/chat",
          file_type: "TXT",
          recording_type: "chat_file",
          status: "completed"
        }]
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response("<html>unsafe</html>", {
        status: 200,
        headers: { "content-type": "text/html" }
      }));

    await expect(zoomRecordingContentProvider.open(chatRecording)).rejects.toMatchObject({
      code: "CONTENT_UNAVAILABLE"
    });
  });

  it("requires completed metadata and probes one MP4 byte before reporting ready", async () => {
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    const cancel = vi.fn().mockResolvedValue(undefined);
    mocks.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recording_files: [{
          id: "provider-file-1",
          download_url: "https://zoom.us/private/file",
          file_type: "MP4",
          recording_type: "shared_screen_with_speaker_view",
          status: "completed"
        }]
      }), { status: 200 }))
      .mockResolvedValueOnce({
        status: 206,
        headers: new Headers({
          "content-type": "video/mp4",
          "content-range": "bytes 0-0/1024",
          "content-length": "1"
        }),
        body: { cancel }
      } as unknown as Response);

    await expect(zoomRecordingContentProvider.getReadiness(recording)).resolves.toEqual({ status: "ready" });
    expect(mocks.fetch.mock.calls[1]?.[1]).toMatchObject({
      redirect: "manual",
      headers: { Authorization: "Bearer provider-token", Range: "bytes=0-0" }
    });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("reports processing without touching content while provider metadata is not completed", async () => {
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      recording_files: [{
        id: "provider-file-1",
        download_url: "https://zoom.us/private/file",
        file_type: "MP4",
        recording_type: "shared_screen_with_speaker_view",
        status: "processing"
      }]
    }), { status: 200 }));

    await expect(zoomRecordingContentProvider.getReadiness(recording)).resolves.toEqual({
      status: "processing",
      retryAfterSeconds: 8
    });
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });

  it("fails closed if the protected open endpoint is called before provider completion", async () => {
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      recording_files: [{
        id: "provider-file-1",
        download_url: "https://zoom.us/private/file",
        file_type: "MP4",
        recording_type: "shared_screen_with_speaker_view",
        status: "processing"
      }]
    }), { status: 200 }));

    await expect(zoomRecordingContentProvider.open(recording)).rejects.toMatchObject({
      code: "METADATA_UNAVAILABLE",
      phase: "metadata",
      category: "status"
    });
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });

  it("maps transient metadata failures to bounded retryable readiness", async () => {
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    mocks.fetch.mockResolvedValueOnce(new Response(null, {
      status: 429,
      headers: { "retry-after": "600" }
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(zoomRecordingContentProvider.getReadiness(recording)).resolves.toEqual({
      status: "retryable",
      retryAfterSeconds: 30
    });
    expect(warn).toHaveBeenCalledWith(
      "Zoom recording readiness check did not complete.",
      { phase: "metadata", category: "throttled" }
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("provider-token");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("provider-file-1");
    warn.mockRestore();
  });

  it("follows a bounded public HTTPS redirect without forwarding Zoom authorization", async () => {
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    mocks.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recording_files: [{
          id: "provider-file-1",
          download_url: "https://zoom.us/private/file",
          file_type: "MP4",
          recording_type: "shared_screen_with_speaker_view",
          status: "completed"
        }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: "https://signed-storage.example.com/object" }
      }))
      .mockResolvedValueOnce(new Response("partial", {
        status: 206,
        headers: {
          "content-type": "video/mp4",
          "content-range": "bytes 0-6/1024"
        }
      }));

    await expect(zoomRecordingContentProvider.open(recording, { range: "bytes=0-6" })).resolves.toMatchObject({
      status: 206
    });
    expect(mocks.fetch.mock.calls[1]?.[1]?.headers).toEqual({
      Authorization: "Bearer provider-token",
      Range: "bytes=0-6"
    });
    expect(mocks.fetch.mock.calls[2]?.[1]?.headers).toEqual({ Range: "bytes=0-6" });
  });

  it.each([
    "http://signed-storage.example.com/object",
    "https://user:password@signed-storage.example.com/object",
    "https://localhost/object",
    "https://127.0.0.1/object",
    "https://10.2.3.4/object",
    "https://[::1]/object",
    "https://signed-storage.example.com:8443/object"
  ])("rejects an unsafe redirect target without requesting it: %s", async (location) => {
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    mocks.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recording_files: [{
          id: "provider-file-1",
          download_url: "https://zoom.us/private/file",
          file_type: "MP4",
          recording_type: "shared_screen_with_speaker_view",
          status: "completed"
        }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location } }));

    await expect(zoomRecordingContentProvider.open(recording)).rejects.toMatchObject({
      code: "CONTENT_UNAVAILABLE",
      phase: "redirect",
      category: "unsafe_target"
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it("stops after the bounded redirect hop count", async () => {
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      recording_files: [{
        id: "provider-file-1",
        download_url: "https://zoom.us/private/file",
        file_type: "MP4",
        recording_type: "shared_screen_with_speaker_view",
        status: "completed"
      }]
    }), { status: 200 }));
    for (let hop = 0; hop < 5; hop += 1) {
      mocks.fetch.mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: `https://zoom.us/private/hop-${hop}` }
      }));
    }

    await expect(zoomRecordingContentProvider.open(recording)).rejects.toMatchObject({
      code: "CONTENT_UNAVAILABLE",
      phase: "redirect",
      category: "status"
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(6);
  });

  it("probes TXT with a header-only request shape and cancels the response body", async () => {
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    const cancel = vi.fn().mockResolvedValue(undefined);
    mocks.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recording_files: [{
          id: "provider-chat-1",
          download_url: "https://zoom.us/private/chat",
          file_type: "TXT",
          recording_type: "chat_file",
          status: "completed"
        }]
      }), { status: 200 }))
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ "content-type": "text/plain" }),
        body: { cancel }
      } as unknown as Response);

    await expect(zoomRecordingContentProvider.getReadiness(chatRecording)).resolves.toEqual({ status: "ready" });
    expect(mocks.fetch.mock.calls[1]?.[1]?.headers).toEqual({ Authorization: "Bearer provider-token" });
    expect(cancel).toHaveBeenCalledOnce();
  });
});
