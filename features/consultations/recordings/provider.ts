import { lookup } from "node:dns/promises";
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
const REDIRECT_DNS_TIMEOUT_MS = 3_000;
const MP4_SIGNATURE_BYTES = 12;
const MP4_PROBE_RANGE = `bytes=0-${MP4_SIGNATURE_BYTES - 1}`;
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
    (a === 192 && b === 88 && octets[2] === 99) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function parseIpv6Hextets(hostname: string): number[] | null {
  let normalized = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "").split("%")[0];
  const dottedIpv4 = normalized.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (dottedIpv4) {
    const octets = dottedIpv4.split(".").map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
      return null;
    }
    normalized = normalized.slice(0, -dottedIpv4.length) +
      `${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }
  if ((normalized.match(/::/g) ?? []).length > 1) return null;
  const [leftText, rightText] = normalized.split("::");
  const left = leftText ? leftText.split(":") : [];
  const right = rightText ? rightText.split(":") : [];
  const missing = normalized.includes("::") ? 8 - left.length - right.length : 0;
  const parts = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  return parts.map((part) => Number.parseInt(part, 16));
}

function isUnsafeIpv6(hostname: string): boolean {
  const hextets = parseIpv6Hextets(hostname);
  if (!hextets) return true;
  const [first, second, , , , sixth, seventh, eighth] = hextets;
  const isUnspecified = hextets.every((part) => part === 0);
  const isLoopback = hextets.slice(0, 7).every((part) => part === 0) && eighth === 1;
  if (isUnspecified || isLoopback) return true;

  const isMappedIpv4 = hextets.slice(0, 5).every((part) => part === 0) && sixth === 0xffff;
  if (isMappedIpv4) {
    return isUnsafeIpv4([
      seventh >> 8,
      seventh & 0xff,
      eighth >> 8,
      eighth & 0xff
    ].join("."));
  }

  const isUniqueLocal = (first & 0xfe00) === 0xfc00;
  const isLinkOrSiteLocal = (first & 0xffc0) === 0xfe80 || (first & 0xffc0) === 0xfec0;
  const isMulticast = (first & 0xff00) === 0xff00;
  const isGlobalUnicast = (first & 0xe000) === 0x2000;
  const isDocumentation = first === 0x2001 && second === 0x0db8;
  const isIanaSpecial = first === 0x2001 && second <= 0x01ff;
  const isSixToFour = first === 0x2002;
  const isDocumentationV2 = (first & 0xfff0) === 0x3ff0;
  return !isGlobalUnicast || isUniqueLocal || isLinkOrSiteLocal || isMulticast ||
    isDocumentation || isIanaSpecial || isSixToFour || isDocumentationV2;
}

function isUnsafeIpAddress(address: string): boolean {
  const normalized = address.replace(/^\[/, "").replace(/\]$/, "");
  const ipVersion = isIP(normalized);
  if (ipVersion === 4) return isUnsafeIpv4(normalized);
  if (ipVersion === 6) return isUnsafeIpv6(normalized);
  return true;
}

function isSafeHttpsTarget(url: URL): boolean {
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || UNSAFE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return false;
  }
  const bareHostname = hostname.replace(/^\[/, "").replace(/\]$/, "");
  const ipVersion = isIP(bareHostname);
  if (ipVersion > 0) return !isUnsafeIpAddress(bareHostname);
  return hostname.includes(".");
}

async function assertSafeResolvedRedirectTarget(target: URL): Promise<void> {
  if (isZoomOwnedHostname(target.hostname)) return;
  const hostname = target.hostname.replace(/^\[/, "").replace(/\]$/, "");
  if (isIP(hostname) > 0) {
    if (isUnsafeIpAddress(hostname)) {
      throw new RecordingProviderError("CONTENT_UNAVAILABLE", "redirect", "unsafe_target");
    }
    return;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const addresses = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(
          new RecordingProviderError(
            "CONTENT_UNAVAILABLE",
            "redirect",
            "network",
            DEFAULT_RETRY_AFTER_SECONDS
          )
        ), REDIRECT_DNS_TIMEOUT_MS);
      })
    ]);
    if (!Array.isArray(addresses) || addresses.length === 0) {
      throw new RecordingProviderError(
        "CONTENT_UNAVAILABLE",
        "redirect",
        "network",
        DEFAULT_RETRY_AFTER_SECONDS
      );
    }
    if (addresses.some((entry) => isUnsafeIpAddress(entry.address))) {
      throw new RecordingProviderError("CONTENT_UNAVAILABLE", "redirect", "unsafe_target");
    }
  } catch (error) {
    if (error instanceof RecordingProviderError) throw error;
    throw new RecordingProviderError(
      "CONTENT_UNAVAILABLE",
      "redirect",
      "network",
      DEFAULT_RETRY_AFTER_SECONDS
    );
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
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
    await assertSafeResolvedRedirectTarget(target);
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

function isGenericBinaryMimeType(contentType: string): boolean {
  return contentType.split(";", 1)[0]?.trim().toLowerCase() === "application/octet-stream";
}

function isRangeStartingAtZero(range?: string): boolean {
  return !range || /^bytes=0-\d*$/.test(range);
}

function hasMp4FileTypeSignature(prefix: Uint8Array): boolean {
  return prefix.byteLength >= MP4_SIGNATURE_BYTES &&
    prefix[4] === 0x66 &&
    prefix[5] === 0x74 &&
    prefix[6] === 0x79 &&
    prefix[7] === 0x70;
}

async function readMp4Prefix(
  body: ReadableStream<Uint8Array> | null
): Promise<{
  reader: ReadableStreamDefaultReader<Uint8Array>;
  chunks: Uint8Array[];
}> {
  if (!body) throw new RecordingProviderError("CONTENT_UNAVAILABLE", "content", "invalid_response");
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (byteLength < MP4_SIGNATURE_BYTES) {
      const result = await reader.read();
      if (result.done || !result.value) break;
      chunks.push(result.value);
      byteLength += result.value.byteLength;
    }
    const prefix = new Uint8Array(Math.min(byteLength, MP4_SIGNATURE_BYTES));
    let offset = 0;
    for (const chunk of chunks) {
      const remaining = prefix.byteLength - offset;
      if (remaining <= 0) break;
      const slice = chunk.subarray(0, remaining);
      prefix.set(slice, offset);
      offset += slice.byteLength;
    }
    if (!hasMp4FileTypeSignature(prefix)) {
      throw new RecordingProviderError("CONTENT_UNAVAILABLE", "content", "invalid_response");
    }
    return { reader, chunks };
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
    if (error instanceof RecordingProviderError) throw error;
    throw new RecordingProviderError(
      "CONTENT_UNAVAILABLE",
      "content",
      "network",
      DEFAULT_RETRY_AFTER_SECONDS
    );
  }
}

async function validateAndDiscardMp4Prefix(body: ReadableStream<Uint8Array> | null): Promise<void> {
  const { reader } = await readMp4Prefix(body);
  await reader.cancel().catch(() => undefined);
  reader.releaseLock();
}

async function validateAndRestoreMp4Stream(
  body: ReadableStream<Uint8Array> | null
): Promise<ReadableStream<Uint8Array>> {
  const { reader, chunks } = await readMp4Prefix(body);
  let prefixIndex = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (prefixIndex < chunks.length) {
        controller.enqueue(chunks[prefixIndex]);
        prefixIndex += 1;
        return;
      }
      try {
        const result = await reader.read();
        if (result.done) {
          reader.releaseLock();
          controller.close();
          return;
        }
        if (result.value) controller.enqueue(result.value);
      } catch (error) {
        reader.releaseLock();
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason).catch(() => undefined);
      reader.releaseLock();
    }
  });
}

async function validateContentResponse(
  recording: AuthorizedRecording,
  response: Response,
  options: { probe: boolean; requestedRange?: string; allowGenericMp4?: boolean }
): Promise<{ contentRange: string | null; genericMp4: boolean }> {
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
  const expectedProbeRange = options.requestedRange?.match(/^bytes=(\d+)-(\d+)$/);
  if (
    options.probe &&
    response.status === 206 &&
    expectedProbeRange &&
    !contentRange?.startsWith(`bytes ${expectedProbeRange[1]}-${expectedProbeRange[2]}/`)
  ) {
    throw new RecordingProviderError("CONTENT_UNAVAILABLE", "content", "range");
  }

  const contentType = response.headers.get("content-type")?.trim();
  if (!contentType) {
    throw new RecordingProviderError("CONTENT_UNAVAILABLE", "content", "invalid_response");
  }
  const genericMp4 = variant.kind === "video" && isGenericBinaryMimeType(contentType);
  if (
    !isEligibleConsultationRecordingMimeType(recording, contentType) &&
    !(options.allowGenericMp4 && genericMp4)
  ) {
    throw new RecordingProviderError("CONTENT_UNAVAILABLE", "content", "invalid_response");
  }
  return { contentRange, genericMp4 };
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
      const range = variant.supportsByteRanges ? MP4_PROBE_RANGE : undefined;
      response = await fetchContentWithSafeRedirects(downloadUrl, accessToken, range);
      await validateContentResponse(recording, response, {
        probe: true,
        requestedRange: range,
        allowGenericMp4: variant.kind === "video"
      });
      if (variant.kind === "video") await validateAndDiscardMp4Prefix(response.body);
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
    let genericMp4Validated = false;
    if (variant.kind === "video" && !isRangeStartingAtZero(options.range)) {
      let probeResponse: Response | null = null;
      try {
        probeResponse = await fetchContentWithSafeRedirects(downloadUrl, accessToken, MP4_PROBE_RANGE);
        await validateContentResponse(recording, probeResponse, {
          probe: true,
          requestedRange: MP4_PROBE_RANGE,
          allowGenericMp4: true
        });
        await validateAndDiscardMp4Prefix(probeResponse.body);
        genericMp4Validated = true;
      } finally {
        await probeResponse?.body?.cancel().catch(() => undefined);
      }
    }
    const contentResponse = await fetchContentWithSafeRedirects(downloadUrl, accessToken, options.range);

    try {
      const { contentRange, genericMp4 } = await validateContentResponse(recording, contentResponse, {
        probe: false,
        requestedRange: options.range,
        allowGenericMp4: variant.kind === "video" && (
          genericMp4Validated || isRangeStartingAtZero(options.range)
        )
      });
      const body = genericMp4 && !genericMp4Validated
        ? await validateAndRestoreMp4Stream(contentResponse.body)
        : contentResponse.body;
      const contentLength = contentResponse.headers.get("content-length");
      return {
        body,
        contentType: variant.responseMimeType,
        contentLength: contentLength && /^\d{1,20}$/.test(contentLength) ? contentLength : null,
        contentRange,
        acceptRanges: variant.supportsByteRanges &&
          (contentResponse.status === 206 || contentResponse.headers.get("accept-ranges")?.toLowerCase() === "bytes")
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
