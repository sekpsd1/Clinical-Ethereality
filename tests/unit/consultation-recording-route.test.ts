import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  session: null as null | { userId: string; role: "doctor" | "admin" | "customer" },
  authorize: vi.fn(),
  external: vi.fn(),
  audit: vi.fn(),
  auditExternal: vi.fn(),
  open: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentSession: () => mocks.session }));
vi.mock("@/features/consultations/recordings/access", () => ({
  getAuthorizedRecording: mocks.authorize,
  auditRecordingAccess: mocks.audit
}));
vi.mock("@/features/consultations/recordings/external-handoff", () => ({
  getRecordingExternalAccess: mocks.external,
  auditExternalRecordingAccessOnce: mocks.auditExternal
}));
vi.mock("@/features/consultations/recordings/provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/consultations/recordings/provider")>();
  return { ...actual, zoomRecordingContentProvider: { open: mocks.open } };
});

import { GET } from "@/app/api/consultations/[consultationId]/recordings/[recordingId]/route";
import { RecordingProviderError } from "@/features/consultations/recordings/provider";
import { parseRecordingRangeHeader } from "@/features/consultations/recordings/range";

const params = Promise.resolve({ consultationId: "consultation-1", recordingId: "recording-1" });
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
const externalAccess = {
  sessionId: "external-session-1",
  tokenHash: "a".repeat(64),
  marker: `recording-external-session:v1:doctor:${"b".repeat(64)}:pending`,
  expiresAt: new Date("2030-01-01T12:00:00.000Z"),
  auditState: "pending" as const,
  viewer: { userId: "doctor-1", role: "doctor" as const },
  recording,
  mode: "view" as const
};

describe("private consultation recording route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = null;
    mocks.authorize.mockResolvedValue(null);
    mocks.external.mockResolvedValue(null);
    mocks.auditExternal.mockResolvedValue("audited");
    mocks.open.mockResolvedValue({
      body: new Response("private-bytes").body,
      contentType: "video/mp4",
      contentLength: "13",
      contentRange: null,
      acceptRanges: "bytes",
      status: 200
    });
  });

  it("keeps normal assigned-doctor sessions backward compatible", async () => {
    mocks.session = { userId: "doctor-1", role: "doctor" };
    mocks.authorize.mockResolvedValue(recording);

    const response = await GET(
      new NextRequest("http://localhost/api/consultations/consultation-1/recordings/recording-1?download=1"),
      { params }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(mocks.audit).toHaveBeenCalledWith(
      { userId: "doctor-1", role: "doctor" },
      recording,
      "download"
    );
    expect(mocks.external).not.toHaveBeenCalled();
  });

  it("serves allowed chat TXT through the protected flow as non-executable text", async () => {
    mocks.session = { userId: "admin-1", role: "admin" };
    mocks.authorize.mockResolvedValue(chatRecording);
    mocks.open.mockResolvedValue({
      body: new Response("<script>alert('blocked')</script>").body,
      contentType: "text/plain; charset=utf-8",
      contentLength: "34",
      contentRange: null,
      acceptRanges: null,
      status: 200
    });

    const response = await GET(
      new NextRequest("http://localhost/api/consultations/consultation-1/recordings/recording-chat-1"),
      { params: Promise.resolve({ consultationId: "consultation-1", recordingId: "recording-chat-1" }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toContain("consultation-recording-recording-chat-1.txt");
    expect(response.headers.get("accept-ranges")).toBeNull();
    expect(mocks.open).toHaveBeenCalledWith(chatRecording, undefined);
    expect(mocks.audit).toHaveBeenCalledOnce();
  });

  it("accepts an exact external recording session without a LINE cookie", async () => {
    mocks.external.mockResolvedValue(externalAccess);

    const response = await GET(
      new NextRequest("http://localhost/api/consultations/consultation-1/recordings/recording-1"),
      { params }
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("private-bytes");
    expect(mocks.auditExternal).toHaveBeenCalledWith(externalAccess);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("serves a concurrent range request only after the same session is revalidated as already audited", async () => {
    mocks.external.mockResolvedValue({ ...externalAccess, auditState: "audited" });
    mocks.auditExternal.mockResolvedValue("already_audited");

    const response = await GET(
      new NextRequest("http://localhost/api/consultations/consultation-1/recordings/recording-1", {
        headers: { range: "bytes=8-15" }
      }),
      { params }
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("private-bytes");
    expect(mocks.auditExternal).toHaveBeenCalledOnce();
  });

  it("fails closed after provider open when the external audit claim is invalid", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    mocks.external.mockResolvedValue(externalAccess);
    mocks.auditExternal.mockResolvedValue("invalid");
    mocks.open.mockResolvedValue({
      body: { cancel } as unknown as ReadableStream<Uint8Array>,
      contentType: "video/mp4",
      contentLength: "13",
      contentRange: null,
      acceptRanges: "bytes",
      status: 200
    });

    const response = await GET(
      new NextRequest("http://localhost/api/consultations/consultation-1/recordings/recording-1"),
      { params }
    );

    expect(mocks.open).toHaveBeenCalledOnce();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication required." });
    expect(cancel).toHaveBeenCalledOnce();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("denies missing and unauthorized sessions before provider access", async () => {
    const anonymous = await GET(
      new NextRequest("http://localhost/api/consultations/consultation-1/recordings/recording-1"),
      { params }
    );
    expect(anonymous.status).toBe(401);

    mocks.session = { userId: "customer-1", role: "customer" };
    const customer = await GET(
      new NextRequest("http://localhost/api/consultations/consultation-1/recordings/recording-1"),
      { params }
    );
    expect(customer.status).toBe(404);
    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.auditExternal).not.toHaveBeenCalled();
  });

  it.each([
    ["M4A", { fileType: "m4a", recordingType: "audio_only" }],
    ["TIMELINE", { fileType: "timeline", recordingType: "timeline" }],
    ["VTT", { fileType: "vtt", recordingType: "audio_transcript" }],
    ["other MP4", { fileType: "mp4", recordingType: "shared_screen_with_gallery_view" }]
  ])("denies a direct %s request even if an upstream authorization mock returns it", async (_label, hidden) => {
    mocks.session = { userId: "admin-1", role: "admin" };
    mocks.authorize.mockResolvedValue({ ...recording, ...hidden });

    const response = await GET(
      new NextRequest("http://localhost/api/consultations/consultation-1/recordings/recording-1"),
      { params }
    );

    expect(response.status).toBe(404);
    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("forwards one valid byte range and returns safe 206 headers", async () => {
    mocks.external.mockResolvedValue(externalAccess);
    mocks.open.mockResolvedValue({
      body: new Response("partial").body,
      contentType: "video/mp4",
      contentLength: "7",
      contentRange: "bytes 0-6/1024",
      acceptRanges: "bytes",
      status: 206
    });
    const response = await GET(
      new NextRequest("http://localhost/api/consultations/consultation-1/recordings/recording-1", {
        headers: { range: "bytes=0-6" }
      }),
      { params }
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 0-6/1024");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(mocks.open).toHaveBeenCalledWith(recording, { range: "bytes=0-6" });
    expect(mocks.auditExternal).toHaveBeenCalledOnce();
  });

  it("rejects multiple, malformed, non-media, and unsatisfiable ranges without audit", async () => {
    expect(parseRecordingRangeHeader("bytes=0-4,6-8", "mp4", BigInt(1024))).toEqual({ kind: "invalid" });
    expect(parseRecordingRangeHeader("bytes=9-1", "mp4", BigInt(1024))).toEqual({ kind: "invalid" });
    expect(parseRecordingRangeHeader("bytes=1024-", "mp4", BigInt(1024))).toEqual({ kind: "invalid" });
    expect(parseRecordingRangeHeader("bytes=0-4", "m4a", BigInt(1024))).toEqual({ kind: "invalid" });
    expect(parseRecordingRangeHeader("bytes=0-4", "txt", BigInt(1024))).toEqual({ kind: "invalid" });

    mocks.external.mockResolvedValue(externalAccess);
    const response = await GET(
      new NextRequest("http://localhost/api/consultations/consultation-1/recordings/recording-1", {
        headers: { range: "bytes=0-4,6-8" }
      }),
      { params }
    );
    expect(response.status).toBe(416);
    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.auditExternal).not.toHaveBeenCalled();
  });

  it("rejects chat TXT Range requests before provider access or audit", async () => {
    mocks.session = { userId: "doctor-1", role: "doctor" };
    mocks.authorize.mockResolvedValue(chatRecording);

    const response = await GET(
      new NextRequest("http://localhost/api/consultations/consultation-1/recordings/recording-chat-1", {
        headers: { range: "bytes=0-6" }
      }),
      { params: Promise.resolve({ consultationId: "consultation-1", recordingId: "recording-chat-1" }) }
    );

    expect(response.status).toBe(416);
    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.auditExternal).not.toHaveBeenCalled();
  });

  it("does not write a successful access audit when the provider fails", async () => {
    mocks.external.mockResolvedValue(externalAccess);
    mocks.open.mockRejectedValue(new RecordingProviderError("CONTENT_UNAVAILABLE"));

    const response = await GET(
      new NextRequest("http://localhost/api/consultations/consultation-1/recordings/recording-1"),
      { params }
    );

    expect(response.status).toBe(502);
    expect(mocks.auditExternal).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
