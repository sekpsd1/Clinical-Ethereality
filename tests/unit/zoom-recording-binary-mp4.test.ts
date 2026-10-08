import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), token: vi.fn() }));
vi.mock("@/lib/env/schema", () => ({ getAppEnv: () => ({ ENABLE_ZOOM_CLOUD_RECORDING: true }) }));
vi.mock("@/lib/zoom/meetings", () => ({ getZoomServerAccessTokenIfConfigured: mocks.token }));
import { zoomRecordingContentProvider } from "@/features/consultations/recordings/provider";
import { boundMp4Body, readMp4Probe, validateMp4Prefix } from "@/features/consultations/recordings/mp4-validation";

const recording = { id: "r", consultationId: "c", provider: "zoom" as const, providerRecordingId: "f",
  fileType: "mp4", recordingType: "shared_screen_with_speaker_view", zoomMeetingId: "m", fileSizeBytes: BigInt(8192) };
function prefix(major = "isom", compatible = "mp42") {
  const bytes = new Uint8Array(4096);
  new DataView(bytes.buffer).setUint32(0, 24);
  bytes.set(new TextEncoder().encode(`ftyp${major}`), 4);
  bytes.set(new TextEncoder().encode(`isom${compatible}`), 16);
  return bytes;
}
function stream(bytes: Uint8Array, cancel = vi.fn()) {
  return new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes); c.close(); }, cancel });
}
function metadata(size: unknown = 8192, pair = { file_type: "MP4", recording_type: recording.recordingType }) {
  return new Response(JSON.stringify({ recording_files: [{ id: "f", download_url: "https://zoom.us/private/file",
    file_size: size, status: "completed", ...pair }] }));
}
function content(body: ReadableStream<Uint8Array> | null, headers: Record<string, string> = {}, status = 206) {
  return new Response(body, { status, headers: { "content-type": "application/octet-stream",
    "content-range": "bytes 4096-4099/8192", "content-length": "4", ...headers } });
}
function probe(bytes = prefix(), headers: Record<string, string> = {}, status = 206) {
  return content(stream(bytes), { "content-range": "bytes 0-4095/8192", "content-length": "4096", ...headers }, status);
}
beforeEach(() => { vi.resetAllMocks(); mocks.token.mockResolvedValue("private-test-token"); vi.stubGlobal("fetch", mocks.fetch); });

describe("bounded octet-stream MP4 provider", () => {
  it("freshly probes byte zero before a nonzero resumed chunk and preserves its bytes", async () => {
    mocks.fetch.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(content(stream(new Uint8Array([9, 8, 7, 6]))))
      .mockResolvedValueOnce(probe());
    const result = await zoomRecordingContentProvider.open(recording, { range: "bytes=4096-4099" });
    expect(result).toMatchObject({ contentType: "video/mp4", contentRange: "bytes 4096-4099/8192", status: 206 });
    expect([...new Uint8Array(await new Response(result.body).arrayBuffer())]).toEqual([9, 8, 7, 6]);
    expect(mocks.fetch.mock.calls[2][1]).toMatchObject({ headers: { Range: "bytes=0-4095", Authorization: "Bearer private-test-token" } });
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
  });
  it("also probes the initial byte for one-byte readiness rather than assuming it is sufficient", async () => {
    mocks.fetch.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(content(stream(new Uint8Array([0])), {
      "content-range": "bytes 0-0/8192", "content-length": "1"
    })).mockResolvedValueOnce(probe());
    const result = await zoomRecordingContentProvider.open(recording, { range: "bytes=0-0" });
    await result.body?.cancel();
    expect(mocks.fetch.mock.calls[2][1].headers.Range).toBe("bytes=0-4095");
  });
  it("does not reuse format evidence from a prior successful open", async () => {
    mocks.fetch.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(content(stream(new Uint8Array(4))))
      .mockResolvedValueOnce(probe());
    const first = await zoomRecordingContentProvider.open(recording, { range: "bytes=4096-4099" });
    await first.body?.cancel();
    mocks.fetch.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(content(stream(new Uint8Array(4))))
      .mockResolvedValueOnce(probe(new Uint8Array(4096)));
    await expect(zoomRecordingContentProvider.open(recording, { range: "bytes=4096-4099" })).rejects.toMatchObject({ code: "CONTENT_UNAVAILABLE" });
    expect(mocks.fetch).toHaveBeenCalledTimes(6);
  });
  it.each(["bytes=8188-", "bytes=-4"])("binds a nonzero open/suffix range %s", async (range) => {
    mocks.fetch.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(content(stream(new Uint8Array(4)), {
      "content-range": "bytes 8188-8191/8192"
    })).mockResolvedValueOnce(probe());
    const result = await zoomRecordingContentProvider.open(recording, { range });
    expect(result.contentRange).toBe("bytes 8188-8191/8192"); await result.body?.cancel();
  });
  it("accepts bounded evidence for a full response without buffering the whole file", async () => {
    const bytes = new Uint8Array(8192); bytes.set(prefix());
    const response = content(stream(bytes), { "content-length": "8192" }, 200);
    response.headers.delete("content-range");
    mocks.fetch.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(response).mockResolvedValueOnce(probe());
    const result = await zoomRecordingContentProvider.open(recording);
    expect(result.status).toBe(200);
    expect((await new Response(result.body).arrayBuffer()).byteLength).toBe(8192);
  });
  it.each([null, 8191, "8192", 0, Number.MAX_SAFE_INTEGER + 1])("rejects unbound source size %s before fetching content", async (size) => {
    const cancel = vi.fn();
    mocks.fetch.mockResolvedValueOnce(metadata(size)).mockResolvedValueOnce(content(new ReadableStream({ cancel })));
    await expect(zoomRecordingContentProvider.open(recording, { range: "bytes=4096-4099" })).rejects.toMatchObject({ code: "METADATA_UNAVAILABLE", diagnostic: { reason: "metadata_size" } });
    expect(mocks.fetch).toHaveBeenCalledOnce(); expect(cancel).not.toHaveBeenCalled();
  });
  it.each([
    [{ "content-range": "bytes 4095-4098/8192" }, 206],
    [{ "content-range": "bytes 4096-4099/8193" }, 206],
    [{ "content-range": "bytes 4096-4099/*" }, 206],
    [{ "content-range": "malformed" }, 206],
    [{ "content-length": "5" }, 206],
    [{ "content-encoding": "gzip" }, 206],
    [{}, 200]
  ] as const)("rejects response range/status/length/encoding mismatch", async (headers, status) => {
    const cancel = vi.fn();
    mocks.fetch.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(content(new ReadableStream({ cancel }), headers, status));
    await expect(zoomRecordingContentProvider.open(recording, { range: "bytes=4096-4099" })).rejects.toMatchObject({ code: "CONTENT_UNAVAILABLE" });
    expect(mocks.fetch).toHaveBeenCalledTimes(2); expect(cancel).toHaveBeenCalledOnce();
  });
  it.each([
    [{ "content-range": "bytes 1-4096/8192" }, 206],
    [{ "content-range": "bytes 0-4095/8193" }, 206],
    [{ "content-length": "4095" }, 206],
    [{ "content-type": "text/html" }, 206],
    [{ "content-encoding": "gzip" }, 206],
    [{}, 200]
  ] as const)("cancels both streams on a bad initial probe", async (headers, status) => {
    const mainCancel = vi.fn(), probeCancel = vi.fn();
    mocks.fetch.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(content(new ReadableStream({ cancel: mainCancel })))
      .mockResolvedValueOnce(content(new ReadableStream({ cancel: probeCancel }), {
        "content-range": "bytes 0-4095/8192", "content-length": "4096", ...headers
      }, status));
    await expect(zoomRecordingContentProvider.open(recording, { range: "bytes=4096-4099" })).rejects.toMatchObject({ code: "CONTENT_UNAVAILABLE" });
    expect(mainCancel).toHaveBeenCalledOnce(); expect(probeCancel).toHaveBeenCalledOnce();
  });
  it("rejects a probe redirect outside the current Zoom hosts", async () => {
    const response = probe(); Object.defineProperty(response, "url", { value: "https://other.example/private" });
    mocks.fetch.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(content(stream(new Uint8Array(4))))
      .mockResolvedValueOnce(response);
    await expect(zoomRecordingContentProvider.open(recording, { range: "bytes=4096-4099" })).rejects.toMatchObject({ code: "CONTENT_UNAVAILABLE" });
  });
  it.each([
    ['"first"', '"second"'], ['"first"', null], [null, '"first"'],
    ['W/"same"', 'W/"same"'], ['"same"', 'W/"same"'], ['W/"same"', '"same"'],
    ["unquoted", "unquoted"]
  ])("rejects asymmetric/mismatched/weak/invalid ETags %s %s and cancels both bodies", async (mainEtag, probeEtag) => {
    const mainCancel = vi.fn(), probeCancel = vi.fn();
    const mainResponse = content(new ReadableStream({ cancel: mainCancel }));
    const probeResponse = content(new ReadableStream({ cancel: probeCancel }), {
      "content-range": "bytes 0-4095/8192", "content-length": "4096"
    });
    if (mainEtag !== null) mainResponse.headers.set("etag", mainEtag);
    if (probeEtag !== null) probeResponse.headers.set("etag", probeEtag);
    mocks.fetch.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(mainResponse).mockResolvedValueOnce(probeResponse);
    await expect(zoomRecordingContentProvider.open(recording, { range: "bytes=4096-4099" })).rejects.toMatchObject({ code: "CONTENT_UNAVAILABLE" });
    expect(mainCancel).toHaveBeenCalledOnce(); expect(probeCancel).toHaveBeenCalledOnce();
  });
  it("accepts equal syntactically strong validators without exposing them", async () => {
    mocks.fetch.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(content(stream(new Uint8Array(4)), { etag: '"same"' }))
      .mockResolvedValueOnce(probe(prefix(), { etag: '"same"' }));
    const result = await zoomRecordingContentProvider.open(recording, { range: "bytes=4096-4099" });
    expect(result).not.toHaveProperty("etag"); await result.body?.cancel();
  });
  it("never enables binary MIME for chat TXT even with MP4-shaped bytes", async () => {
    mocks.fetch.mockResolvedValueOnce(metadata(8192, { file_type: "TXT", recording_type: "chat_file" }))
      .mockResolvedValueOnce(content(stream(prefix()), {}, 200));
    await expect(zoomRecordingContentProvider.open({ ...recording, fileType: "txt", recordingType: "chat_file" })).rejects.toMatchObject({ code: "CONTENT_UNAVAILABLE" });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it.each(["text/html", "application/x-private", null])("does not sniff unknown or absent MIME %s", async (type) => {
    const response = content(stream(prefix()));
    if (type) response.headers.set("content-type", type); else response.headers.delete("content-type");
    mocks.fetch.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(response);
    await expect(zoomRecordingContentProvider.open(recording, { range: "bytes=4096-4099" })).rejects.toMatchObject({ code: "CONTENT_UNAVAILABLE" });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it.each([new Uint8Array(4096), new TextEncoder().encode("<html>login</html>"), prefix().subarray(0, 20)])(
    "rejects hostile or truncated prefix without yielding the requested bytes", async (bytes) => {
      const mainCancel = vi.fn();
      mocks.fetch.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(content(new ReadableStream({ cancel: mainCancel })))
        .mockResolvedValueOnce(probe(bytes));
      await expect(zoomRecordingContentProvider.open(recording, { range: "bytes=4096-4099" })).rejects.toMatchObject({ code: "CONTENT_UNAVAILABLE" });
      expect(mainCancel).toHaveBeenCalledOnce();
    }
  );
});

describe("MP4 evidence and bounded streams", () => {
  it("accepts a complete ftyp with one explicit MP4 compatible brand", () => {
    const bytes = prefix(); new DataView(bytes.buffer).setUint32(0, 20);
    bytes.set(new TextEncoder().encode("mp42"), 16);
    expect(() => validateMp4Prefix(bytes, BigInt(8192))).not.toThrow();
  });
  it.each(["isom", "iso2", "avc1", "mp41", "mp42"])("accepts recognized major %s with MP4 compatibility", (brand) => {
    expect(() => validateMp4Prefix(prefix(brand), BigInt(8192))).not.toThrow();
  });
  it.each([0, 1, 16, 23, 25, 4097, 8192])("rejects invalid ftyp length %s", (size) => {
    const bytes = prefix(); new DataView(bytes.buffer).setUint32(0, size);
    expect(() => validateMp4Prefix(bytes, BigInt(8192))).toThrow();
  });
  it.each([["qt  ", "mp42"], ["M4A ", "mp42"], ["avif", "mp42"], ["isom", "iso2"]])(
    "rejects non-MP4 major/compatibility %s %s", (major, compatible) => {
      expect(() => validateMp4Prefix(prefix(major, compatible), BigInt(8192))).toThrow();
    }
  );
  it("rejects incomplete ftyp payload, a displaced box and control-byte brands", () => {
    const bytes = prefix(); new DataView(bytes.buffer).setUint32(0, 4100);
    expect(() => validateMp4Prefix(bytes, BigInt(8192))).toThrow();
    expect(() => validateMp4Prefix(new Uint8Array([0, ...prefix()]), BigInt(8192))).toThrow();
    const bad = prefix(); bad[16] = 0;
    expect(() => validateMp4Prefix(bad, BigInt(8192))).toThrow();
  });
  it("bounds a stalled probe and cancels upstream", async () => {
    vi.useFakeTimers();
    try {
      const cancel = vi.fn();
      const pending = readMp4Probe(new ReadableStream({ cancel }), 4096);
      const rejected = expect(pending).rejects.toThrow("MP4 probe unavailable");
      await vi.advanceTimersByTimeAsync(10_001); await rejected;
      expect(cancel).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });
  it("assembles split transport chunks within the probe bound", async () => {
    const bytes = prefix();
    const body = new ReadableStream<Uint8Array>({ start(c) {
      c.enqueue(bytes.subarray(0, 7)); c.enqueue(bytes.subarray(7, 19)); c.enqueue(bytes.subarray(19)); c.close();
    } });
    expect(await readMp4Probe(body, 4096)).toEqual(bytes);
  });
  it("rejects an oversized probe chunk and cancels it without emitting bytes", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(4097)); }, cancel });
    await expect(readMp4Probe(body, 4096)).rejects.toThrow(); expect(cancel).toHaveBeenCalledOnce();
  });
  it.each([3, 5])("rejects actual body length %s when four bytes were promised", async (length) => {
    await expect(new Response(boundMp4Body(stream(new Uint8Array(length)), BigInt(4))).arrayBuffer()).rejects.toThrow();
  });
  it("does not eagerly pull and propagates downstream cancellation", async () => {
    const pull = vi.fn(), cancel = vi.fn();
    const body = boundMp4Body(new ReadableStream({ pull, cancel }, { highWaterMark: 0 }), BigInt(8192));
    await Promise.resolve(); expect(pull).not.toHaveBeenCalled();
    await body.cancel(); expect(cancel).toHaveBeenCalledOnce();
  });
});
