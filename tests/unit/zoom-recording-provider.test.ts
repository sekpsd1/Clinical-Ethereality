import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: { ENABLE_ZOOM_CLOUD_RECORDING: false },
  token: vi.fn(),
  fetch: vi.fn()
}));
vi.mock("@/lib/env/schema", () => ({ getAppEnv: () => mocks.env }));
vi.mock("@/lib/zoom/meetings", () => ({ getZoomServerAccessTokenIfConfigured: mocks.token }));

import {
  probeRecordingContentAvailability,
  type RecordingContentProvider,
  zoomRecordingContentProvider
} from "@/features/consultations/recordings/provider";

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

  it.each([undefined, null, "processing", "failed", "unknown", "COMPLETED"])(
    "rejects incomplete or unknown MP4 status %s before content requests", async (status) => {
      mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
      mocks.token.mockResolvedValue("provider-token");
      mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ recording_files: [{
        id: recording.providerRecordingId, file_type: "MP4", recording_type: recording.recordingType,
        file_size: 1024, status, download_url: "https://zoom.us/private/file"
      }] })));
      await expect(zoomRecordingContentProvider.open(recording)).rejects.toMatchObject({
        code: "METADATA_UNAVAILABLE", diagnostic: { reason: "metadata_status" }
      });
      expect(mocks.fetch).toHaveBeenCalledOnce();
    }
  );

  it.each([undefined, null, 0, -1, 1023, 1024.5, "1024", Number.MAX_SAFE_INTEGER + 1])(
    "rejects mismatched or unsafe canonical MP4 size %s before content requests", async (fileSize) => {
      mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
      mocks.token.mockResolvedValue("provider-token");
      mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ recording_files: [{
        id: recording.providerRecordingId, file_type: "MP4", recording_type: recording.recordingType,
        status: "completed", file_size: fileSize, download_url: "https://zoom.us/private/file"
      }] })));
      await expect(zoomRecordingContentProvider.open(recording, { range: "bytes=0-0" })).rejects.toMatchObject({
        code: "METADATA_UNAVAILABLE", diagnostic: { reason: "metadata_size" }
      });
      expect(mocks.fetch).toHaveBeenCalledOnce();
    }
  );

  it("retains native MP4 support for legacy unknown DB size after completed metadata", async () => {
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ recording_files: [{
      id: recording.providerRecordingId, file_type: "MP4", recording_type: recording.recordingType,
      status: "completed", download_url: "https://zoom.us/private/file"
    }] }))).mockResolvedValueOnce(new Response("video", { headers: { "content-type": "video/mp4" } }));
    await expect(zoomRecordingContentProvider.open({ ...recording, fileSizeBytes: null })).resolves.toMatchObject({ status: 200 });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it("fails closed without token or provider requests while the flag is off", async () => {
    await expect(zoomRecordingContentProvider.open(recording)).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    expect(mocks.token).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([
    { status: 403, headers: {}, reason: "content_status", finalUrl: undefined },
    { status: 206, headers: { "content-range": "invalid" }, reason: "content_range", finalUrl: undefined },
    { status: 200, headers: { "content-type": "text/html" }, reason: "content_mime", finalUrl: undefined },
    { status: 200, headers: { "content-type": "video/mp4" }, reason: "redirect_host", finalUrl: "https://untrusted.example/private-token" }
  ])("reports only fixed diagnostic reason $reason and numeric status", async ({ status, headers, reason, finalUrl }) => {
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    const response = new Response(null, { status, headers: headers as HeadersInit });
    if (finalUrl) Object.defineProperty(response, "url", { value: finalUrl });
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ recording_files: [{ id: recording.providerRecordingId,
      file_type: "MP4", status: "completed", file_size: 1024, recording_type: recording.recordingType, download_url: "https://zoom.us/private/file" }] })))
      .mockResolvedValueOnce(response);
    await expect(zoomRecordingContentProvider.open(recording)).rejects.toMatchObject({ diagnostic: { reason, httpStatus: status } });
  });

  it("probes MP4 with one byte and cancels the stream without buffering or auditing", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn().mockResolvedValue({
        body: { cancel } as unknown as ReadableStream<Uint8Array>,
        contentType: "video/mp4",
        contentLength: "1",
        contentRange: "bytes 0-0/1024",
        acceptRanges: "bytes" as const,
        status: 206 as const
      });
    const provider: RecordingContentProvider = { open };

    await probeRecordingContentAvailability(recording, provider);

    expect(open).toHaveBeenCalledWith(recording, { range: "bytes=0-0" });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([
    [null, "missing"],
    ["Application/Octet-Stream; private=SECRET", "octet_stream"],
    ["text/html; private=SECRET", "html"],
    ["text/plain; charset=utf-8", "text_plain"],
    ["audio/mp4; private=SECRET", "other"],
    ["SECRET", "other"]
  ])("classifies rejected MP4 MIME as %s without serializing headers", async (contentType, mimeClass) => {
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    const cancel = vi.fn();
    const headers = new Headers({ "content-range": "bytes 0-3/1024" });
    if (contentType !== null) headers.set("content-type", contentType);
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ recording_files: [{
      id: recording.providerRecordingId, file_type: "MP4", status: "completed", file_size: 1024, recording_type: recording.recordingType,
      download_url: "https://zoom.us/private/file"
    }] }))).mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { status: 206, headers }));
    const error = await zoomRecordingContentProvider.open(recording, { range: "bytes=0-3" }).catch((value) => value);
    expect(error).toMatchObject({ code: "CONTENT_UNAVAILABLE",
      diagnostic: { reason: "content_mime", httpStatus: 206, mimeClass } });
    expect(JSON.stringify(error.diagnostic)).not.toMatch(/SECRET|private|provider-token/);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("classifies a rejected chat video MIME without enabling it", async () => {
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ recording_files: [{
      id: chatRecording.providerRecordingId, file_type: "TXT", recording_type: "chat_file",
      download_url: "https://zoom.us/private/chat"
    }] }))).mockResolvedValueOnce(new Response(null, { headers: { "content-type": "video/mp4" } }));
    await expect(zoomRecordingContentProvider.open(chatRecording)).rejects.toMatchObject({
      code: "CONTENT_UNAVAILABLE", diagnostic: { reason: "content_mime", httpStatus: 200, mimeClass: "video_mp4" }
    });
  });

  it("forwards one byte range and accepts only safe partial-content headers", async () => {
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    mocks.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recording_files: [{
          id: "provider-file-1",
          download_url: "https://zoom.us/private/file",
          file_type: "MP4", status: "completed", file_size: 1024,
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
        file_type: "MP4", status: "completed", file_size: 1024,
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
          file_type: "MP4", status: "completed", file_size: 1024,
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

  it("serves exact chat TXT metadata as non-executable UTF-8 text without range semantics", async () => {
    mocks.env.ENABLE_ZOOM_CLOUD_RECORDING = true;
    mocks.token.mockResolvedValue("provider-token");
    mocks.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        recording_files: [{
          id: "provider-chat-1",
          download_url: "https://zoom.us/private/chat",
          file_type: "TXT",
          recording_type: "chat_file"
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
        file_type: "MP4", status: "completed", file_size: 1024,
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
          recording_type: "chat_file"
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
});
