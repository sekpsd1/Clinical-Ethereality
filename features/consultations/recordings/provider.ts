import { getAppEnv } from "@/lib/env/schema";
import { getZoomServerAccessTokenIfConfigured } from "@/lib/zoom/meetings";
import type { AuthorizedRecording } from "@/features/consultations/recordings/access";

export class RecordingProviderError extends Error {
  constructor(
    public readonly code:
      | "NOT_CONFIGURED"
      | "METADATA_UNAVAILABLE"
      | "CONTENT_UNAVAILABLE"
      | "RANGE_NOT_SATISFIABLE"
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
  recording_files?: Array<{ id?: unknown; download_url?: unknown }>;
};

export const zoomRecordingContentProvider: RecordingContentProvider = {
  async open(recording, options = {}) {
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
    if (!metadataResponse.ok) throw new RecordingProviderError("METADATA_UNAVAILABLE");

    const metadata = await metadataResponse.json() as ZoomRecordingList;
    const file = metadata.recording_files?.find(
      (candidate) => String(candidate.id) === recording.providerRecordingId
    );
    if (!file || typeof file.download_url !== "string") {
      throw new RecordingProviderError("METADATA_UNAVAILABLE");
    }

    const downloadUrl = new URL(file.download_url);
    if (downloadUrl.protocol !== "https:" || (downloadUrl.hostname !== "zoom.us" && !downloadUrl.hostname.endsWith(".zoom.us"))) {
      throw new RecordingProviderError("METADATA_UNAVAILABLE");
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
        throw new RecordingProviderError("CONTENT_UNAVAILABLE");
      }
    }
    if (contentResponse.status === 416) {
      throw new RecordingProviderError("RANGE_NOT_SATISFIABLE");
    }
    if (contentResponse.status !== 200 && contentResponse.status !== 206) {
      throw new RecordingProviderError("CONTENT_UNAVAILABLE");
    }

    const contentRange = contentResponse.headers.get("content-range");
    const safeContentRange = contentRange && /^bytes \d+-\d+\/(?:\d+|\*)$/.test(contentRange)
      ? contentRange
      : null;
    if (contentResponse.status === 206 && !safeContentRange) {
      throw new RecordingProviderError("CONTENT_UNAVAILABLE");
    }

    const contentLength = contentResponse.headers.get("content-length");

    return {
      body: contentResponse.body,
      contentType: contentResponse.headers.get("content-type") ?? "application/octet-stream",
      contentLength: contentLength && /^\d{1,20}$/.test(contentLength) ? contentLength : null,
      contentRange: safeContentRange,
      acceptRanges: contentResponse.headers.get("accept-ranges")?.toLowerCase() === "bytes" ? "bytes" : null,
      status: contentResponse.status
    };
  }
};

// Future archival storage plugs into this contract without exposing a public URL.
export interface PrivateRecordingArchive {
  archive(input: {
    recording: AuthorizedRecording;
    content: PrivateRecordingContent;
  }): Promise<{ privateStorageKey: string }>;
}
