import { isIP } from "node:net";
import { getAppEnv } from "@/lib/env/schema";
import { getZoomServerAccessTokenIfConfigured } from "@/lib/zoom/meetings";
import type { AuthorizedRecording } from "@/features/consultations/recordings/access";
import {
  getConsultationRecordingVariant,
  isExactConsultationRecordingMetadata,
  isEligibleConsultationRecordingMetadata,
  isEligibleConsultationRecordingMimeType
} from "@/features/consultations/recordings/policy";

type RecordingProviderPhase = "configuration" | "metadata" | "redirect" | "content";
type RecordingProviderCategory =
  | "authentication"
  | "invalid_response"
  | "missing_file"
  | "network"
  | "not_found"
  | "range"
  | "server"
  | "status"
  | "throttled"
  | "unsafe_target";

export class RecordingProviderError extends Error {
  constructor(
    public readonly code:
      | "NOT_CONFIGURED"
      | "METADATA_UNAVAILABLE"
      | "CONTENT_UNAVAILABLE"
      | "RANGE_NOT_SATISFIABLE",
    public readonly phase: RecordingProviderPhase = "content",
    public readonly category: RecordingProviderCategory = "invalid_response",
    public readonly retryAfterSeconds?: number
  ) {
    super(code);
    this.name = "RecordingProviderError";
  }
}

export type RecordingReadinessStatus = "ready" | "processing" | "retryable" | "unavailable";

export type PrivateRecordingReadiness = {
  status: RecordingReadinessStatus;
  retryAfterSeconds?: number;
};

export type PrivateRecordingContent = {
  body: ReadableStream<Uint8Array> | null;
  contentType: string;
  contentLength: string | null;
  contentRange: string | null;
  acceptRanges: "bytes" | null;
  status: 200 | 206;
};

export interface RecordingContentProvider {
  open(recording: AuthorizedRecording, options?: { range?: string }): Promise<PrivateRecordingContent>;
  getReadiness(recording: AuthorizedRecording): Promise<PrivateRecordingReadiness>;
}

type ZoomRecordingFile = {
  id?: unknown;
  download_url?: unknown;
  file_type?: unknown;
  recording_type?: unknown;
  status?: unknown;
};

type ZoomRecordingList = {
  recording_files?: ZoomRecordingFile[];
};

const MAX_REDIRECT_HOPS = 4;
const DEFAULT_RETRY_AFTER_SECONDS = 8;
const MIN_RETRY_AFTER_SECONDS = 2;
const MAX_RETRY_AFTER_SECONDS = 30;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const UNSAFE_HOST_SUFFIXES = [
  ".example",
  ".internal",
  ".invalid",
  ".lan",
  ".local",
  ".localhost",
  ".test"
];

function isZoomOwnedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized === "zoom.us" || normalized.endsWith(".zoom.us");
}

function isUnsafeIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return true;
  }
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function isUnsafeIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("ff") || normalized.startsWith("2001:db8:")) return true;
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mappedIpv4 ? isUnsafeIpv4(mappedIpv4) : false;
}

function isSafeHttpsTarget(url: URL): boolean {
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || UNSAFE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return false;
  }
  const bareHostname = hostname.replace(/^\[/, "").replace(/\]$/, "");
  const ipVersion = isIP(bareHostname);
  if (ipVersion === 4) return !isUnsafeIpv4(bareHostname);
  if (ipVersion === 6) return !isUnsafeIpv6(bareHostname);
  return hostname.includes(".");
}

function getBoundedRetryAfter(response: Response): number {
  const value = response.headers.get("retry-after")?.trim() ?? "";
  const seconds = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isFinite(seconds)) return DEFAULT_RETRY_AFTER_SECONDS;
  return Math.min(MAX_RETRY_AFTER_SECONDS, Math.max(MIN_RETRY_AFTER_SECONDS, Math.round(seconds)));
}

function providerErrorForStatus(
  response: Response,
  phase: "metadata" | "content",
  code: "METADATA_UNAVAILABLE" | "CONTENT_UNAVAILABLE"
): RecordingProviderError {
  if (response.status === 401 || response.status === 403) {
    return new RecordingProviderError(code, phase, "authentication");
  }
  if (response.status === 404 || response.status === 410) {
    return new RecordingProviderError(code, phase, "not_found");
  }
  if (response.status === 429) {
    return new RecordingProviderError(code, phase, "throttled", getBoundedRetryAfter(response));
  }
  if (response.status >= 500 || response.status === 408 || response.status === 425) {
    return new RecordingProviderError(code, phase, "server", getBoundedRetryAfter(response));
  }
  return new RecordingProviderError(code, phase, "status");
}

function getSafeInitialDownloadUrl(value: unknown): URL {
  if (typeof value !== "string") {
    throw new RecordingProviderError("METADATA_UNAVAILABLE", "metadata", "invalid_response");
  }
  try {
    const url = new URL(value);
    if (!isSafeHttpsTarget(url) || !isZoomOwnedHostname(url.hostname)) {
      throw new RecordingProviderError("METADATA_UNAVAILABLE", "metadata", "unsafe_target");
    }
    return url;
  } catch (error) {
    if (error instanceof RecordingProviderError) throw error;
    throw new RecordingProviderError("METADATA_UNAVAILABLE", "metadata", "invalid_response");
  }
}

async function fetchMetadataFile(
  recording: AuthorizedRecording,
  accessToken: string
): Promise<ZoomRecordingFile> {
  let response: Response;
  try {
    response = await fetch(
      `https://api.zoom.us/v2/meetings/${encodeURIComponent(recording.zoomMeetingId)}/recordings`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15_000)
      }
    );
  } catch {
    throw new RecordingProviderError("METADATA_UNAVAILABLE", "metadata", "network", DEFAULT_RETRY_AFTER_SECONDS);
  }
  if (!response.ok) throw providerErrorForStatus(response, "metadata", "METADATA_UNAVAILABLE");

  let metadata: ZoomRecordingList;
  try {
    metadata = await response.json() as ZoomRecordingList;
  } catch {
    throw new RecordingProviderError("METADATA_UNAVAILABLE", "metadata", "invalid_response");
  }
  const file = metadata.recording_files?.find((candidate) =>
    String(candidate.id) === recording.providerRecordingId &&
    typeof candidate.file_type === "string" &&
    typeof candidate.recording_type === "string" &&
    isExactConsultationRecordingMetadata(recording, {
      fileType: candidate.file_type,
      recordingType: candidate.recording_type
    })
  );
  if (!file) throw new RecordingProviderError("METADATA_UNAVAILABLE", "metadata", "missing_file");
  return file;
}

async function fetchContentWithSafeRedirects(
  initialUrl: URL,
  accessToken: string,
  range?: string
): Promise<Response> {
  let target = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    let response: Response;
    try {
      response = await fetch(target, {
        headers: {
          ...(isZoomOwnedHostname(target.hostname) ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(range ? { Range: range } : {})
        },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(30_000)
      });
    } catch {
      throw new RecordingProviderError("CONTENT_UNAVAILABLE", "content", "network", DEFAULT_RETRY_AFTER_SECONDS);
    }

    if (!REDIRECT_STATUSES.has(response.status)) return response;
    await response.body?.cancel().catch(() => undefined);
    if (hop === MAX_REDIRECT_HOPS) {
      throw new RecordingProviderError("CONTENT_UNAVAILABLE", "redirect", "status");
    }
    const location = response.headers.get("location");
    if (!location) throw new RecordingProviderError("CONTENT_UNAVAILABLE", "redirect", "invalid_response");
    try {
      const nextTarget = new URL(location, target);
      if (!isSafeHttpsTarget(nextTarget)) {
        throw new RecordingProviderError("CONTENT_UNAVAILABLE", "redirect", "unsafe_target");
      }
      target = nextTarget;
    } catch (error) {
      if (error instanceof RecordingProviderError) throw error;
      throw new RecordingProviderError("CONTENT_UNAVAILABLE", "redirect", "invalid_response");
    }
  }
  throw new RecordingProviderError("CONTENT_UNAVAILABLE", "redirect", "status");
}

function getSafeContentRange(response: Response, supportsByteRanges: boolean): string | null {
  const contentRange = response.headers.get("content-range");
  return supportsByteRanges && contentRange && /^bytes \d+-\d+\/(?:\d+|\*)$/.test(contentRange)
    ? contentRange
    : null;
}

async function validateContentResponse(
  recording: AuthorizedRecording,
  response: Response,
  options: { probe: boolean; requestedRange?: string }
): Promise<{ contentRange: string | null }> {
  const variant = getConsultationRecordingVariant(recording);
  if (!variant) throw new RecordingProviderError("CONTENT_UNAVAILABLE", "content", "invalid_response");
  if (variant.supportsByteRanges && response.status === 416) {
    throw new RecordingProviderError("RANGE_NOT_SATISFIABLE", "content", "range");
  }
  if (response.status !== 200 && (response.status !== 206 || !variant.supportsByteRanges)) {
    throw providerErrorForStatus(response, "content", "CONTENT_UNAVAILABLE");
  }

  const contentRange = getSafeContentRange(response, variant.supportsByteRanges);
  if (response.status === 206 && !contentRange) {
    throw new RecordingProviderError("CONTENT_UNAVAILABLE", "content", "range");
  }
  if (options.probe && options.requestedRange === "bytes=0-0" && response.status === 206 && !contentRange?.startsWith("bytes 0-0/")) {
    throw new RecordingProviderError("CONTENT_UNAVAILABLE", "content", "range");
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  if (!isEligibleConsultationRecordingMimeType(recording, contentType)) {
    throw new RecordingProviderError("CONTENT_UNAVAILABLE", "content", "invalid_response");
  }
  return { contentRange };
}

function mapReadinessError(error: unknown): PrivateRecordingReadiness {
  if (!(error instanceof RecordingProviderError)) {
    return { status: "retryable", retryAfterSeconds: DEFAULT_RETRY_AFTER_SECONDS };
  }
  if (error.category === "missing_file") {
    return { status: "processing", retryAfterSeconds: DEFAULT_RETRY_AFTER_SECONDS };
  }
  if (["network", "server", "throttled"].includes(error.category)) {
    return { status: "retryable", retryAfterSeconds: error.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS };
  }
  return { status: "unavailable" };
}

function logReadinessFailure(error: unknown): void {
  console.warn("Zoom recording readiness check did not complete.", {
    phase: error instanceof RecordingProviderError ? error.phase : "content",
    category: error instanceof RecordingProviderError ? error.category : "invalid_response"
  });
}

async function getProviderCredentials(): Promise<string> {
  const env = getAppEnv();
  if (!env.ENABLE_ZOOM_CLOUD_RECORDING) {
    throw new RecordingProviderError("NOT_CONFIGURED", "configuration", "status");
  }
  const accessToken = await getZoomServerAccessTokenIfConfigured();
  if (!accessToken) throw new RecordingProviderError("NOT_CONFIGURED", "configuration", "authentication");
  return accessToken;
}

function assertEligibleRecording(recording: AuthorizedRecording): NonNullable<ReturnType<typeof getConsultationRecordingVariant>> {
  const variant = getConsultationRecordingVariant(recording);
  if (!variant || !isEligibleConsultationRecordingMetadata(recording)) {
    throw new RecordingProviderError("CONTENT_UNAVAILABLE", "content", "invalid_response");
  }
  return variant;
}

export const zoomRecordingContentProvider: RecordingContentProvider = {
  async getReadiness(recording) {
    let response: Response | null = null;
    try {
      const variant = assertEligibleRecording(recording);
      const accessToken = await getProviderCredentials();
      const file = await fetchMetadataFile(recording, accessToken);
      const status = typeof file.status === "string" ? file.status.toLowerCase() : "";
      if (status !== "completed") {
        return status === "processing" || status === "waiting"
          ? { status: "processing", retryAfterSeconds: DEFAULT_RETRY_AFTER_SECONDS }
          : { status: "unavailable" };
      }

      const downloadUrl = getSafeInitialDownloadUrl(file.download_url);
      const range = variant.supportsByteRanges ? "bytes=0-0" : undefined;
      response = await fetchContentWithSafeRedirects(downloadUrl, accessToken, range);
      await validateContentResponse(recording, response, { probe: true, requestedRange: range });
      return { status: "ready" };
    } catch (error) {
      logReadinessFailure(error);
      return mapReadinessError(error);
    } finally {
      await response?.body?.cancel().catch(() => undefined);
    }
  },

  async open(recording, options = {}) {
    const variant = assertEligibleRecording(recording);
    if (options.range && !variant.supportsByteRanges) {
      throw new RecordingProviderError("RANGE_NOT_SATISFIABLE", "content", "range");
    }
    const accessToken = await getProviderCredentials();
    const file = await fetchMetadataFile(recording, accessToken);
    if (typeof file.status !== "string" || file.status.toLowerCase() !== "completed") {
      throw new RecordingProviderError("METADATA_UNAVAILABLE", "metadata", "status");
    }
    const downloadUrl = getSafeInitialDownloadUrl(file.download_url);
    const contentResponse = await fetchContentWithSafeRedirects(downloadUrl, accessToken, options.range);

    try {
      const { contentRange } = await validateContentResponse(recording, contentResponse, {
        probe: false,
        requestedRange: options.range
      });
      const contentLength = contentResponse.headers.get("content-length");
      return {
        body: contentResponse.body,
        contentType: variant.responseMimeType,
        contentLength: contentLength && /^\d{1,20}$/.test(contentLength) ? contentLength : null,
        contentRange,
        acceptRanges: variant.supportsByteRanges &&
          contentResponse.headers.get("accept-ranges")?.toLowerCase() === "bytes"
          ? "bytes"
          : null,
        status: contentResponse.status as 200 | 206
      };
    } catch (error) {
      await contentResponse.body?.cancel().catch(() => undefined);
      throw error;
    }
  }
};

// Future archival storage plugs into this contract without exposing a public URL.
export interface PrivateRecordingArchive {
  archive(input: {
    recording: AuthorizedRecording;
    content: PrivateRecordingContent;
  }): Promise<{ privateStorageKey: string }>;
}
