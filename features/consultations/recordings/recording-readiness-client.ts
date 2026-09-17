import type { RecordingReadinessStatus } from "@/features/consultations/recordings/provider";

export type RecordingReadinessResult = {
  status: RecordingReadinessStatus;
  retryAfterSeconds?: number;
};

export type FetchRecordingReadiness = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "json">>;

export const RECORDING_READINESS_MAX_AUTO_ATTEMPTS = 6;
export const RECORDING_READINESS_MAX_WINDOW_MS = 90_000;

const READINESS_STATUSES = new Set<RecordingReadinessStatus>([
  "ready",
  "processing",
  "retryable",
  "unavailable"
]);

export function getRecordingReadinessDelayMs(attempt: number, retryAfterSeconds?: number): number {
  const exponentialMs = Math.min(30_000, 2_000 * 2 ** Math.max(0, Math.min(attempt, 5)));
  const providerMs = typeof retryAfterSeconds === "number" && Number.isFinite(retryAfterSeconds)
    ? Math.min(30_000, Math.max(2_000, Math.round(retryAfterSeconds * 1_000)))
    : 0;
  return Math.max(exponentialMs, providerMs);
}

export function shouldAutoRetryRecordingReadiness(status: RecordingReadinessStatus): boolean {
  return status === "processing" || status === "retryable";
}

export async function requestRecordingReadiness(
  consultationId: string,
  recordingId: string,
  signal?: AbortSignal,
  fetchReadiness: FetchRecordingReadiness = fetch
): Promise<RecordingReadinessResult> {
  const response = await fetchReadiness(
    `/api/consultations/${encodeURIComponent(consultationId)}/recordings/${encodeURIComponent(recordingId)}/readiness`,
    {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal
    }
  );
  const payload = await response.json() as { status?: unknown; retryAfterSeconds?: unknown };
  if (!response.ok || typeof payload.status !== "string" || !READINESS_STATUSES.has(payload.status as RecordingReadinessStatus)) {
    throw new Error("recording_readiness_unavailable");
  }
  const retryAfterSeconds = typeof payload.retryAfterSeconds === "number" &&
    Number.isInteger(payload.retryAfterSeconds) &&
    payload.retryAfterSeconds >= 2 &&
    payload.retryAfterSeconds <= 30
    ? payload.retryAfterSeconds
    : undefined;
  return {
    status: payload.status as RecordingReadinessStatus,
    ...(retryAfterSeconds ? { retryAfterSeconds } : {})
  };
}
