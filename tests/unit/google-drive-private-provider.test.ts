import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ enabled: false, lookup: vi.fn(), token: vi.fn(), folder: vi.fn(), metadata: vi.fn(), fetch: vi.fn(), zoom: vi.fn() }));
vi.mock("@/lib/env/schema", () => ({ getAppEnv: () => ({ ENABLE_GOOGLE_DRIVE_RECORDING_ARCHIVE: mocks.enabled }) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { consultationRecording: { findFirst: mocks.lookup } } }));
vi.mock("@/features/consultations/recordings/drive-client", async (original) => ({
  ...await original<typeof import("@/features/consultations/recordings/drive-client")>(),
  getDriveArchiveConfig: () => ({ folderId: "private-folder" }), getDriveAccessToken: mocks.token,
  assertPrivateArchiveFolder: mocks.folder, getDriveFile: mocks.metadata, driveFetch: mocks.fetch
}));
vi.mock("@/features/consultations/recordings/provider", async (original) => ({
  ...await original<typeof import("@/features/consultations/recordings/provider")>(),
  zoomRecordingContentProvider: { open: mocks.zoom }
}));
import { privateRecordingContentProvider } from "@/features/consultations/recordings/private-provider";
const recording = { id: "recording-test", consultationId: "consult-test", provider: "zoom" as const,
  providerRecordingId: "provider-test", fileType: "mp4", recordingType: "shared_screen_with_speaker_view",
  fileSizeBytes: BigInt(4), zoomMeetingId: "meeting-test" };
beforeEach(() => {
  vi.resetAllMocks(); mocks.enabled = true;
  mocks.lookup.mockResolvedValue({ archiveDriveFileId: "file-test", fileSizeBytes: BigInt(4) });
  mocks.token.mockResolvedValue("test-token"); mocks.folder.mockResolvedValue(undefined);
  mocks.metadata.mockResolvedValue({ id: "file-test", size: "4", mimeType: "video/mp4", trashed: false,
    parents: ["private-folder"], appProperties: { clinicalRecording: "recording-test" }, permissions: [{ type: "user", role: "owner" }] });
  mocks.zoom.mockResolvedValue({ status: 200, contentType: "video/mp4", body: null });
});
it("keeps disabled-by-default playback on Zoom without archive lookup", async () => {
  mocks.enabled = false;
  await privateRecordingContentProvider.open(recording);
  expect(mocks.lookup).not.toHaveBeenCalled(); expect(mocks.zoom).toHaveBeenCalledWith(recording, undefined);
});
it("serves verified Drive range through existing private proxy", async () => {
  mocks.fetch.mockResolvedValue(new Response(new Uint8Array([1, 2]), { status: 206,
    headers: { "Content-Type": "video/mp4", "Content-Range": "bytes 0-1/4", "Content-Length": "2" } }));
  const result = await privateRecordingContentProvider.open(recording, { range: "bytes=0-1" });
  expect(result.status).toBe(206); expect(result.contentRange).toBe("bytes 0-1/4");
  expect(mocks.zoom).not.toHaveBeenCalled();
  expect(mocks.fetch).toHaveBeenCalledWith("test-token", "files/file-test?alt=media", { headers: { Range: "bytes=0-1" } });
});
it("retains Zoom fallback when Drive grant/quota/privacy fails", async () => {
  mocks.folder.mockRejectedValue(new Error("not private"));
  await privateRecordingContentProvider.open(recording);
  expect(mocks.zoom).toHaveBeenCalledOnce(); expect(mocks.fetch).not.toHaveBeenCalled();
});
it("never serves mismatched recording binding from Drive", async () => {
  mocks.metadata.mockResolvedValue({ id: "file-test", size: "4", mimeType: "video/mp4", trashed: false,
    parents: ["private-folder"], appProperties: { clinicalRecording: "other-recording" } });
  await privateRecordingContentProvider.open(recording);
  expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.zoom).toHaveBeenCalledOnce();
});
it("rejects executable Drive content and uses validated Zoom fallback", async () => {
  mocks.fetch.mockResolvedValue(new Response("<html>", { status: 200, headers: { "Content-Type": "text/html" } }));
  await privateRecordingContentProvider.open(recording);
  expect(mocks.zoom).toHaveBeenCalledOnce();
});
it("refuses individually shared child even when destination folder is private", async () => {
  mocks.metadata.mockResolvedValue({ id: "file-test", size: "4", mimeType: "video/mp4", trashed: false,
    parents: ["private-folder"], appProperties: { clinicalRecording: recording.id },
    permissions: [{ type: "user", role: "owner" }, { type: "anyone", role: "reader" }] });
  await privateRecordingContentProvider.open(recording);
  expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.zoom).toHaveBeenCalledOnce();
});
it.each([
  { status: 200, headers: { "Content-Type": "video/mp4", "Content-Length": "4" } },
  { status: 206, headers: { "Content-Type": "video/mp4", "Content-Range": "bytes 0-1/5", "Content-Length": "2" } },
  { status: 206, headers: { "Content-Type": "video/mp4", "Content-Range": "bytes 1-2/4", "Content-Length": "2" } },
  { status: 206, headers: { "Content-Type": "video/mp4", "Content-Range": "bytes 0-1/4", "Content-Length": "3" } }
])("refuses ignored or mismatched Drive byte-range response %#", async (init) => {
  mocks.fetch.mockResolvedValue(new Response(new Uint8Array([1, 2]), init as ResponseInit));
  await privateRecordingContentProvider.open(recording, { range: "bytes=0-1" });
  expect(mocks.zoom).toHaveBeenCalledOnce();
});
