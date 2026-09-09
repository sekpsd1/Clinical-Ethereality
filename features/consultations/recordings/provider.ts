import { getAppEnv } from "@/lib/env/schema";
import { getZoomServerAccessTokenIfConfigured } from "@/lib/zoom/meetings";
import type { AuthorizedRecording } from "@/features/consultations/recordings/access";

export class RecordingProviderError extends Error {
  constructor(public readonly code: "NOT_CONFIGURED" | "METADATA_UNAVAILABLE" | "CONTENT_UNAVAILABLE") {
    super(code);
    this.name = "RecordingProviderError";
  }
}

export type PrivateRecordingContent = {
  body: ReadableStream<Uint8Array> | null;
  contentType: string;
  contentLength: string | null;
};

export interface RecordingContentProvider {
  open(recording: AuthorizedRecording): Promise<PrivateRecordingContent>;
}

type ZoomRecordingList = {
  recording_files?: Array<{ id?: unknown; download_url?: unknown }>;
};

export const zoomRecordingContentProvider: RecordingContentProvider = {
  async open(recording) {
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
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(30_000)
    });
    if (!contentResponse.ok) throw new RecordingProviderError("CONTENT_UNAVAILABLE");

    return {
      body: contentResponse.body,
      contentType: contentResponse.headers.get("content-type") ?? "application/octet-stream",
      contentLength: contentResponse.headers.get("content-length")
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
