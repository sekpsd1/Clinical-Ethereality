import { getAppEnv } from "@/lib/env/schema";
import { getZoomServerAccessTokenIfConfigured } from "@/lib/zoom/meetings";
import type { AuthorizedRecording } from "@/features/consultations/recordings/access";
import {
  getConsultationRecordingVariant,
  isExactConsultationRecordingMetadata,
  isEligibleConsultationRecordingMetadata,
  isEligibleConsultationRecordingMimeType
} from "@/features/consultations/recordings/policy";

export type RecordingProviderFailureReason = "metadata_response" | "metadata_missing" | "download_host" | "redirect_host" | "content_status" | "content_range" | "content_mime";
export type RecordingProviderMimeClass = "missing" | "octet_stream" | "html" | "video_mp4" | "text_plain" | "other";

function classifyProviderMime(contentType: string | null): RecordingProviderMimeClass {
  if (contentType === null) return "missing";
  switch (contentType.split(";", 1)[0].trim().toLowerCase()) {
    case "application/octet-stream": return "octet_stream";
    case "text/html": return "html";
    case "video/mp4": return "video_mp4";
    case "text/plain": return "text_plain";
    default: return "other";
  }
}
export class RecordingProviderError extends Error {
  constructor(
    public readonly code:
      | "NOT_CONFIGURED"
      | "METADATA_UNAVAILABLE"
      | "CONTENT_UNAVAILABLE"
      | "RANGE_NOT_SATISFIABLE",
    public readonly diagnostic?: { reason: RecordingProviderFailureReason; httpStatus?: number; mimeClass?: RecordingProviderMimeClass }
  ) {
    super(code);
    this.name = "RecordingProviderError";
  }
}

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
}

type ZoomRecordingList = {
  recording_files?: Array<{
    id?: unknown;
    download_url?: unknown;
    file_type?: unknown;
    recording_type?: unknown;
  }>;
};

export const zoomRecordingContentProvider: RecordingContentProvider = {
  async open(recording, options = {}) {
    const variant = getConsultationRecordingVariant(recording);
    if (!variant || !isEligibleConsultationRecordingMetadata(recording)) {
      throw new RecordingProviderError("CONTENT_UNAVAILABLE");
    }
    if (options.range && !variant.supportsByteRanges) {
      throw new RecordingProviderError("RANGE_NOT_SATISFIABLE");
    }

    const env = getAppEnv();
    if (!env.ENABLE_ZOOM_CLOUD_RECORDING) {
      throw new RecordingProviderError("NOT_CONFIGURED");
    }

    const accessToken = await getZoomServerAccessTokenIfConfigured();
    if (!accessToken) throw new RecordingProviderError("NOT_CONFIGURED");

    const metadataResponse = await fetch(
      `https://api.zoom.us/v2/meetings/${encodeURIComponent(recording.zoomMeetingId)}/recordings`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000)
      }
    );
    if (!metadataResponse.ok) throw new RecordingProviderError("METADATA_UNAVAILABLE", { reason: "metadata_response", httpStatus: metadataResponse.status });

    const metadata = await metadataResponse.json() as ZoomRecordingList;
    const file = metadata.recording_files?.find((candidate) =>
      String(candidate.id) === recording.providerRecordingId &&
      typeof candidate.file_type === "string" &&
      typeof candidate.recording_type === "string" &&
      isExactConsultationRecordingMetadata(recording, {
        fileType: candidate.file_type,
        recordingType: candidate.recording_type
      })
    );
    if (!file || typeof file.download_url !== "string") {
      throw new RecordingProviderError("METADATA_UNAVAILABLE", { reason: "metadata_missing" });
    }

    const downloadUrl = new URL(file.download_url);
    if (downloadUrl.protocol !== "https:" || (downloadUrl.hostname !== "zoom.us" && !downloadUrl.hostname.endsWith(".zoom.us"))) {
      throw new RecordingProviderError("METADATA_UNAVAILABLE", { reason: "download_host" });
    }

    const contentResponse = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.range ? { Range: options.range } : {})
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(30_000)
    });
    if (contentResponse.url) {
      const finalUrl = new URL(contentResponse.url);
      if (
        finalUrl.protocol !== "https:" ||
        (finalUrl.hostname !== "zoom.us" && !finalUrl.hostname.endsWith(".zoom.us"))
      ) {
        throw new RecordingProviderError("CONTENT_UNAVAILABLE", { reason: "redirect_host", httpStatus: contentResponse.status });
      }
    }
    if (variant.supportsByteRanges && contentResponse.status === 416) {
      throw new RecordingProviderError("RANGE_NOT_SATISFIABLE", { reason: "content_status", httpStatus: contentResponse.status });
    }
    if (
      contentResponse.status !== 200 &&
      (contentResponse.status !== 206 || !variant.supportsByteRanges)
    ) {
      throw new RecordingProviderError("CONTENT_UNAVAILABLE", { reason: "content_status", httpStatus: contentResponse.status });
    }

    const contentRange = contentResponse.headers.get("content-range");
    const safeContentRange = variant.supportsByteRanges && contentRange && /^bytes \d+-\d+\/(?:\d+|\*)$/.test(contentRange)
      ? contentRange
      : null;
    if (contentResponse.status === 206 && !safeContentRange) {
      throw new RecordingProviderError("CONTENT_UNAVAILABLE", { reason: "content_range", httpStatus: contentResponse.status });
    }

    const providerContentType = contentResponse.headers.get("content-type");
    const contentType = providerContentType ?? "application/octet-stream";
    if (!isEligibleConsultationRecordingMimeType(recording, contentType)) {
      await contentResponse.body?.cancel().catch(() => undefined);
      throw new RecordingProviderError("CONTENT_UNAVAILABLE", { reason: "content_mime", httpStatus: contentResponse.status,
        mimeClass: classifyProviderMime(providerContentType) });
    }

    const contentLength = contentResponse.headers.get("content-length");

    return {
      body: contentResponse.body,
      contentType: variant.responseMimeType,
      contentLength: contentLength && /^\d{1,20}$/.test(contentLength) ? contentLength : null,
      contentRange: safeContentRange,
      acceptRanges: variant.supportsByteRanges &&
        contentResponse.headers.get("accept-ranges")?.toLowerCase() === "bytes"
        ? "bytes"
        : null,
      status: contentResponse.status
    };
  }
};

export async function probeRecordingContentAvailability(
  recording: AuthorizedRecording,
  provider?: RecordingContentProvider
): Promise<void> {
  const variant = getConsultationRecordingVariant(recording);
  if (!variant || !isEligibleConsultationRecordingMetadata(recording)) {
    throw new RecordingProviderError("CONTENT_UNAVAILABLE");
  }

  const activeProvider = provider ?? (await import("./private-provider")).privateRecordingContentProvider;
  const content = await activeProvider.open(
    recording,
    variant.supportsByteRanges ? { range: "bytes=0-0" } : undefined
  );
  await content.body?.cancel().catch(() => undefined);
}

// Future archival storage plugs into this contract without exposing a public URL.
export interface PrivateRecordingArchive {
  archive(input: {
    recording: AuthorizedRecording;
    content: PrivateRecordingContent;
  }): Promise<{ privateStorageKey: string }>;
}
