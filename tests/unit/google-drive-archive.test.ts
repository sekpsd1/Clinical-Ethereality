import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), updateMany: vi.fn(), transaction: vi.fn(), audit: vi.fn(),
  getToken: vi.fn(), folder: vi.fn(), file: vi.fn(), driveFetch: vi.fn(), zoomOpen: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { consultationRecording: { findFirst: mocks.findFirst,
  updateMany: mocks.updateMany }, $transaction: mocks.transaction } }));
vi.mock("@/lib/audit/audit-log", () => ({ writeAuditLog: mocks.audit }));
vi.mock("@/features/consultations/recordings/provider", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/consultations/recordings/provider")>(),
  zoomRecordingContentProvider: { open: mocks.zoomOpen }
}));
vi.mock("@/features/consultations/recordings/drive-client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/consultations/recordings/drive-client")>(),
  getDriveArchiveConfig: () => ({ folderId: "private-folder", sessionKey: "ab".repeat(32) }),
  getDriveAccessToken: mocks.getToken, assertPrivateArchiveFolder: mocks.folder, getDriveFile: mocks.file,
  driveFetch: mocks.driveFetch
}));
import { archiveOneRecordingStep, parseUploadOffset, readBoundedChunk, ARCHIVE_CHUNK_BYTES } from "@/features/consultations/recordings/drive-archive";
import { decryptUploadSession, encryptUploadSession, validateUploadSession, verifyDriveFile } from "@/features/consultations/recordings/drive-client";
import { RecordingProviderError } from "@/features/consultations/recordings/provider";

const sessionUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test";
const candidate = { id: "recording-test", consultationId: "consult-test", provider: "zoom", fileType: "MP4",
  recordingType: "shared_screen_with_speaker_view", fileSizeBytes: BigInt(4), archiveDriveFileId: "file-test",
  archiveSession: encryptUploadSession(sessionUrl, "recording-test", "ab".repeat(32)), archiveAttempts: 0,
  consultation: { zoomMeetingId: "meeting-test" } };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findFirst.mockResolvedValue(candidate); mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (fn) => fn({ consultationRecording: { updateMany: mocks.updateMany } }));
  mocks.getToken.mockResolvedValue("test-token"); mocks.folder.mockResolvedValue(undefined); mocks.file.mockResolvedValue(null);
  vi.stubGlobal("fetch", vi.fn());
});

const exactCandidate = { ...candidate, providerRecordingId: "provider-test" };
const target = { recordingId: candidate.id, consultationId: candidate.consultationId, providerRecordingId: "provider-test",
  zoomMeetingId: "meeting-test", fileSizeBytes: "4", fileType: "mp4" as const, recordingType: "shared_screen_with_speaker_view" as const };
describe("exact target ownership", () => {
  it("selects and CAS claims only the bound row, keeping binding on subsequent writes", async () => {
    mocks.findFirst.mockResolvedValue(exactCandidate);
    mocks.getToken.mockRejectedValue(new Error("unavailable"));
    expect(await archiveOneRecordingStep(target)).toEqual({ status: "retry", stage: "drive_prepare", code: "PROVIDER_UNAVAILABLE", targetMatched: true });
    const binding = { id: target.recordingId, consultationId: target.consultationId, providerRecordingId: target.providerRecordingId,
      fileSizeBytes: BigInt(4), consultation: { zoomMeetingId: target.zoomMeetingId } };
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining(binding) }));
    for (const [query] of mocks.updateMany.mock.calls) expect(query.where).toEqual(expect.objectContaining(binding));
  });
  it("does not select another row when target is missing/ineligible", async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect(await archiveOneRecordingStep(target)).toEqual({ status: "idle", targetMatched: false });
    expect(mocks.findFirst).toHaveBeenCalledTimes(1); expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.getToken).not.toHaveBeenCalled();
  });
  it.each([ { id: "other" }, { consultationId: "other" }, { providerRecordingId: "other" },
    { fileSizeBytes: BigInt(5) }, { fileType: "txt" }, { recordingType: "chat_file" }, { provider: "other" },
    { consultation: { zoomMeetingId: "other" } } ])("rejects changed immutable binding before any claim: %#", async change => {
    mocks.findFirst.mockResolvedValue({ ...exactCandidate, ...change });
    expect(await archiveOneRecordingStep(target)).toEqual({ status: "idle", targetMatched: false });
    expect(mocks.updateMany).not.toHaveBeenCalled(); expect(mocks.getToken).not.toHaveBeenCalled();
  });
  it("does not fall back after losing the target lease", async () => {
    mocks.findFirst.mockResolvedValue(exactCandidate); mocks.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await archiveOneRecordingStep(target)).toEqual({ status: "idle", targetMatched: false });
    expect(mocks.findFirst).toHaveBeenCalledTimes(1); expect(mocks.getToken).not.toHaveBeenCalled();
  });
  it("validates targets even for direct callers", async () => {
    expect(await archiveOneRecordingStep({ ...target, fileSizeBytes: "0" })).toEqual({ status: "failed", code: "INVALID_METADATA", targetMatched: false });
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
  it("reconciles exactly the same completed file on a later target invocation", async () => {
    mocks.findFirst.mockResolvedValue(exactCandidate);
    mocks.file.mockResolvedValue({ id: "file-test", size: "4", mimeType: "video/mp4", trashed: false,
      parents: ["private-folder"], appProperties: { clinicalRecording: "recording-test" }, permissions: [{ type: "user", role: "owner" }] });
    expect(await archiveOneRecordingStep(target)).toEqual({ status: "archived", targetMatched: true });
    expect(mocks.audit).toHaveBeenCalledTimes(1); expect(mocks.zoomOpen).not.toHaveBeenCalled();
  });
  it("resumes the exact target from provider acknowledgment and releases its bound lease", async () => {
    mocks.findFirst.mockResolvedValue(exactCandidate);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 308, headers: { Range: "bytes=0-1" } }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    mocks.zoomOpen.mockResolvedValue({ status: 206, contentRange: "bytes 2-3/4",
      body: new ReadableStream({ start(c) { c.enqueue(new Uint8Array([3, 4])); c.close(); } }) });
    expect(await archiveOneRecordingStep(target)).toEqual({ status: "progress", targetMatched: true });
    expect(mocks.zoomOpen).toHaveBeenCalledWith(expect.objectContaining({ providerRecordingId: target.providerRecordingId }), { range: "bytes=2-3" });
    expect(mocks.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({
      id: target.recordingId, providerRecordingId: target.providerRecordingId }), data: expect.objectContaining({ archiveOffset: BigInt(4), archiveLeaseToken: null }) }));
  });
});

describe("durable private Drive archive", () => {
  it("deduplicates a completed upload after a lost completion response and audits exactly once", async () => {
    mocks.file.mockResolvedValue({ id: "file-test", size: "4", mimeType: "video/mp4", trashed: false,
      parents: ["private-folder"], appProperties: { clinicalRecording: "recording-test" }, permissions: [{ type: "user", role: "owner" }] });
    expect(await archiveOneRecordingStep()).toEqual({ status: "archived" });
    expect(fetch).not.toHaveBeenCalled(); expect(mocks.zoomOpen).not.toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ archiveStatus: "archived", archiveSession: null }) }));
  });
  it("uploads one bounded chunk and persists offset; verifies completion on a later invocation", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 308 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    mocks.zoomOpen.mockResolvedValue({ status: 206, contentRange: "bytes 0-3/4",
      body: new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1, 2, 3, 4])); c.close(); } }) });
    expect(await archiveOneRecordingStep()).toEqual({ status: "progress" });
    expect(mocks.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ archiveOffset: BigInt(4), archiveStatus: "uploading" }) }));
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("honors provider offset after restart rather than stale database offset", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 308, headers: { Range: "bytes=0-1" } }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    mocks.zoomOpen.mockResolvedValue({ status: 206, contentRange: "bytes 2-3/4",
      body: new ReadableStream({ start(c) { c.enqueue(new Uint8Array([3, 4])); c.close(); } }) });
    expect(await archiveOneRecordingStep()).toEqual({ status: "progress" });
    expect(mocks.zoomOpen).toHaveBeenCalledWith(expect.anything(), { range: "bytes=2-3" });
  });
  it("refuses concurrent lease losers without an external request", async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await archiveOneRecordingStep()).toEqual({ status: "idle" });
    expect(mocks.getToken).not.toHaveBeenCalled();
  });
  it("retries provider failures without marking archived", async () => {
    mocks.getToken.mockRejectedValue(new Error("safe test failure"));
    expect(await archiveOneRecordingStep()).toEqual({ status: "retry", stage: "drive_prepare", code: "PROVIDER_UNAVAILABLE" });
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("stops after the bounded retry budget", async () => {
    mocks.findFirst.mockResolvedValue({ ...candidate, archiveAttempts: 11 });
    mocks.getToken.mockRejectedValue(new Error("safe test failure"));
    expect(await archiveOneRecordingStep()).toEqual({ status: "failed", stage: "drive_prepare", code: "PROVIDER_UNAVAILABLE" });
  });
  it("refuses different bytes/metadata under a reserved Drive ID", async () => {
    mocks.file.mockResolvedValue({ id: "file-test", size: "5", mimeType: "video/mp4", trashed: false,
      parents: ["private-folder"], appProperties: { clinicalRecording: "recording-test" }, permissions: [{ type: "user", role: "owner" }] });
    expect(await archiveOneRecordingStep()).toEqual({ status: "failed", stage: "completion_verify", code: "INVALID_METADATA" });
    expect(mocks.zoomOpen).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("rejects Zoom ignoring byte ranges rather than buffering full recordings", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 308 }));
    mocks.zoomOpen.mockResolvedValue({ status: 200, contentRange: null, body: null });
    expect(await archiveOneRecordingStep()).toEqual({ status: "failed", stage: "zoom_download", code: "INVALID_METADATA" });
  });
  it("identifies Zoom source failure with a fixed code only", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 308 }));
    mocks.zoomOpen.mockRejectedValue(new RecordingProviderError("CONTENT_UNAVAILABLE"));
    expect(await archiveOneRecordingStep()).toEqual({ status: "retry", stage: "zoom_download", code: "CONTENT_UNAVAILABLE" });
  });
  it("does not serialize secret-bearing unknown errors", async () => {
    mocks.getToken.mockRejectedValue(new Error("Bearer SECRET https://private.example/patient"));
    const result = await archiveOneRecordingStep();
    expect(result).toEqual({ status: "retry", stage: "drive_prepare", code: "PROVIDER_UNAVAILABLE" });
    expect(JSON.stringify(result)).not.toMatch(/SECRET|Bearer|private|patient/);
  });
  it("rejects a forged provider code at the serialization boundary", async () => {
    const error = new RecordingProviderError("CONTENT_UNAVAILABLE");
    Object.assign(error, { code: "Bearer SECRET", message: "private patient URL" });
    mocks.getToken.mockRejectedValue(error);
    expect(await archiveOneRecordingStep()).toEqual({ status: "retry", stage: "drive_prepare", code: "PROVIDER_UNAVAILABLE" });
  });
  it("propagates fixed source reason and bounded status only", async () => {
    mocks.getToken.mockRejectedValue(new RecordingProviderError("CONTENT_UNAVAILABLE", { reason: "content_status", httpStatus: 403 }));
    expect(await archiveOneRecordingStep()).toEqual({ status: "retry", stage: "drive_prepare", code: "CONTENT_UNAVAILABLE", reason: "content_status", httpStatus: 403 });
  });
  it("omits forged diagnostic text and out-of-range status", async () => {
    const error = new RecordingProviderError("CONTENT_UNAVAILABLE");
    Object.assign(error, { diagnostic: { reason: "Bearer SECRET", httpStatus: 999 } });
    mocks.getToken.mockRejectedValue(error);
    expect(await archiveOneRecordingStep()).toEqual({ status: "retry", stage: "drive_prepare", code: "CONTENT_UNAVAILABLE" });
    Object.assign(error, { diagnostic: { reason: "content_status", httpStatus: 999 } });
    expect(await archiveOneRecordingStep()).toEqual({ status: "retry", stage: "drive_prepare", code: "CONTENT_UNAVAILABLE", reason: "content_status" });
  });

  it.each(["missing", "octet_stream", "html", "video_mp4", "text_plain", "other"] as const)(
    "serializes only fixed MIME class %s at the archive boundary", async (mimeClass) => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 308 }));
      mocks.zoomOpen.mockRejectedValue(new RecordingProviderError("CONTENT_UNAVAILABLE", {
        reason: "content_mime", httpStatus: 206, mimeClass
      }));
      expect(await archiveOneRecordingStep()).toEqual({ status: "retry", stage: "zoom_download",
        code: "CONTENT_UNAVAILABLE", reason: "content_mime", httpStatus: 206, mimeClass });
      expect(fetch).toHaveBeenCalledOnce();
      expect(mocks.audit).not.toHaveBeenCalled();
    }
  );

  it.each(["content_mime", "content_status", "Bearer SECRET"])(
    "omits secret-bearing forged MIME class for reason %s", async (reason) => {
      const error = new RecordingProviderError("CONTENT_UNAVAILABLE");
      Object.assign(error, { diagnostic: { reason, httpStatus: 206, mimeClass: "Bearer SECRET private-url" } });
      mocks.getToken.mockRejectedValue(error);
      const result = await archiveOneRecordingStep();
      expect(result).not.toHaveProperty("mimeClass");
      expect(JSON.stringify(result)).not.toMatch(/SECRET|private-url|Bearer/);
    }
  );

  it("does not propagate even an allowlisted MIME class for unrelated errors", async () => {
    const error = new RecordingProviderError("CONTENT_UNAVAILABLE", {
      reason: "content_status", httpStatus: 403, mimeClass: "octet_stream"
    });
    mocks.getToken.mockRejectedValue(error);
    expect(await archiveOneRecordingStep()).not.toHaveProperty("mimeClass");
  });
});

describe("archive safety primitives", () => {
  it("bounds a stalled body read and cancels the stream", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    await expect(readBoundedChunk(stream, 4, 10)).rejects.toThrow("PROVIDER_UNAVAILABLE");
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("encrypts upload capability and binds it to recording ID", () => {
    const value = encryptUploadSession(sessionUrl, "one", "ab".repeat(32));
    expect(value).not.toContain("upload_id");
    expect(decryptUploadSession(value, "one", "ab".repeat(32))).toEqual(sessionUrl);
    expect(() => decryptUploadSession(value, "two", "ab".repeat(32))).toThrow();
  });
  it.each(["http://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=x",
    "https://evil.example/upload/drive/v3/files?uploadType=resumable&upload_id=x",
    "https://www.googleapis.com/drive/v3/files?uploadType=resumable&upload_id=x"])("rejects unsafe upload URL %s", (url) => {
    expect(() => validateUploadSession(url)).toThrow();
  });
  it("validates acknowledged contiguous ranges", () => {
    expect(parseUploadOffset(null, BigInt(8))).toBe(BigInt(0));
    expect(parseUploadOffset("bytes=0-3", BigInt(8))).toBe(BigInt(4));
    expect(() => parseUploadOffset("bytes=1-3", BigInt(8))).toThrow();
    expect(() => parseUploadOffset("bytes=0-9", BigInt(8))).toThrow();
  });
  it("rejects oversized and truncated streams", async () => {
    const stream = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(5)); c.close(); } });
    await expect(readBoundedChunk(stream(), 4)).rejects.toThrow();
    await expect(readBoundedChunk(stream(), 6)).rejects.toThrow();
    await expect(readBoundedChunk(stream(), ARCHIVE_CHUNK_BYTES + 1)).rejects.toThrow();
  });
  it("requires folder identity and app recording binding", () => {
    expect(() => verifyDriveFile({ id: "f", size: "2", mimeType: "video/mp4", trashed: false, parents: ["other"] },
      { id: "f", size: BigInt(2), mimeType: "video/mp4", folderId: "expected", recordingId: "r" })).toThrow();
  });
});
