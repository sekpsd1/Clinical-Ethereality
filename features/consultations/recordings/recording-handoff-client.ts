import type { RecordingAccessMode } from "@/features/consultations/recordings/external-handoff";

const ID_PATTERN = /^[A-Za-z0-9_-]{8,191}$/;
const HANDOFF_TICKET_PATTERN = /^v1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{40,64}$/;

export type RecordingHandoffDescriptor = {
  consultationId: string;
  recordingId: string;
  mode: RecordingAccessMode;
};

type HandoffResponse = {
  ok?: unknown;
  launchUrl?: unknown;
};

type ExchangeResponse = {
  ok?: unknown;
  consultationId?: unknown;
  recordingId?: unknown;
  mode?: unknown;
};

export type FetchRecordingHandoff = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "json">>;

export function isLineInAppBrowser(userAgent: string): boolean {
  return /\bLine\/[0-9.]+/i.test(userAgent);
}

export function isAndroidUserAgent(userAgent: string): boolean {
  return /\bAndroid\b/i.test(userAgent);
}

function hasExactDescriptor(url: URL, descriptor?: RecordingHandoffDescriptor): boolean {
  const consultationId = url.searchParams.get("consultation")?.trim() ?? "";
  const recordingId = url.searchParams.get("recording")?.trim() ?? "";
  const mode = url.searchParams.get("mode")?.trim() ?? "";
  const allowedKeys = new Set(["consultation", "recording", "mode", "openExternalBrowser"]);

  if (
    [...url.searchParams.keys()].some((key) => !allowedKeys.has(key)) ||
    !ID_PATTERN.test(consultationId) ||
    !ID_PATTERN.test(recordingId) ||
    (mode !== "view" && mode !== "download")
  ) {
    return false;
  }

  return !descriptor || (
    descriptor.consultationId === consultationId &&
    descriptor.recordingId === recordingId &&
    descriptor.mode === mode
  );
}

export function getRecordingHandoffTicket(fragment: string): string | null {
  if (!fragment.startsWith("#")) return null;
  const params = new URLSearchParams(fragment.slice(1));
  const ticket = params.get("handoff")?.trim();
  return params.size === 1 && ticket && HANDOFF_TICKET_PATTERN.test(ticket) ? ticket : null;
}

export function isTrustedRecordingLaunchUrl(
  value: string,
  currentOrigin: string,
  descriptor?: RecordingHandoffDescriptor
): boolean {
  try {
    const url = new URL(value);
    return (
      url.origin === currentOrigin &&
      url.pathname === "/recordings/handoff" &&
      !url.username &&
      !url.password &&
      !url.searchParams.has("handoff") &&
      hasExactDescriptor(url, descriptor) &&
      Boolean(getRecordingHandoffTicket(url.hash))
    );
  } catch {
    return false;
  }
}

export function buildIosRecordingExternalBrowserUrl(
  value: string,
  currentOrigin: string,
  descriptor?: RecordingHandoffDescriptor
): string | null {
  if (!isTrustedRecordingLaunchUrl(value, currentOrigin, descriptor)) return null;
  const url = new URL(value);
  url.searchParams.set("openExternalBrowser", "1");
  return url.toString();
}

export function getRecordingLaunchTarget(
  value: string,
  currentOrigin: string,
  userAgent: string,
  descriptor: RecordingHandoffDescriptor
): string | null {
  if (!isTrustedRecordingLaunchUrl(value, currentOrigin, descriptor)) return null;
  return isLineInAppBrowser(userAgent) && !isAndroidUserAgent(userAgent)
    ? buildIosRecordingExternalBrowserUrl(value, currentOrigin, descriptor)
    : value;
}

export function buildAndroidRecordingChromeIntentUrl(currentUrl: string): string | null {
  try {
    const target = new URL(currentUrl);
    if (
      target.protocol !== "https:" ||
      target.pathname !== "/recordings/handoff" ||
      target.searchParams.has("handoff") ||
      !hasExactDescriptor(target) ||
      !getRecordingHandoffTicket(target.hash)
    ) {
      return null;
    }

    target.searchParams.delete("openExternalBrowser");
    const fallbackUrl = target.toString();
    return `intent://${target.host}${target.pathname}${target.search}${target.hash}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
  } catch {
    return null;
  }
}

export function getSanitizedRecordingHandoffPath(currentUrl: string): string | null {
  try {
    const target = new URL(currentUrl);
    if (!target.searchParams.has("handoff") && !target.hash) return null;
    target.searchParams.delete("handoff");
    target.hash = "";
    return `${target.pathname}${target.search}`;
  } catch {
    return null;
  }
}

export function getRecordingHandoffDescriptor(currentUrl: string): RecordingHandoffDescriptor | null {
  try {
    const url = new URL(currentUrl);
    if (url.pathname !== "/recordings/handoff" || !hasExactDescriptor(url)) return null;
    return {
      consultationId: url.searchParams.get("consultation")!,
      recordingId: url.searchParams.get("recording")!,
      mode: url.searchParams.get("mode") as RecordingAccessMode
    };
  } catch {
    return null;
  }
}

export function getProtectedRecordingUrl(descriptor: RecordingHandoffDescriptor): string {
  const base = `/api/consultations/${encodeURIComponent(descriptor.consultationId)}/recordings/${encodeURIComponent(descriptor.recordingId)}`;
  return descriptor.mode === "download" ? `${base}?download=1` : base;
}

export async function requestRecordingHandoff(
  descriptor: RecordingHandoffDescriptor,
  currentOrigin: string,
  userAgent: string,
  fetchHandoff: FetchRecordingHandoff = fetch
): Promise<string> {
  const response = await fetchHandoff(
    `/api/consultations/${encodeURIComponent(descriptor.consultationId)}/recordings/${encodeURIComponent(descriptor.recordingId)}/handoff`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ mode: descriptor.mode })
    }
  );
  const payload = (await response.json()) as HandoffResponse;
  const target = typeof payload.launchUrl === "string"
    ? getRecordingLaunchTarget(payload.launchUrl, currentOrigin, userAgent, descriptor)
    : null;
  if (!response.ok || payload.ok !== true || !target) throw new Error("recording_handoff_unavailable");
  return target;
}

export async function exchangeRecordingHandoffSession(
  descriptor: RecordingHandoffDescriptor,
  fragment: string,
  fetchSession: FetchRecordingHandoff = fetch
): Promise<void> {
  const ticket = getRecordingHandoffTicket(fragment);
  if (!ticket) throw new Error("recording_handoff_invalid");

  const response = await fetchSession("/api/recordings/handoff/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ ticket, ...descriptor })
  });
  const payload = (await response.json()) as ExchangeResponse;
  if (
    !response.ok ||
    payload.ok !== true ||
    payload.consultationId !== descriptor.consultationId ||
    payload.recordingId !== descriptor.recordingId ||
    payload.mode !== descriptor.mode
  ) {
    throw new Error("recording_handoff_invalid");
  }
}

export function createRecordingHandoffRequestGate() {
  let pending = false;
  return {
    async run<T>(task: () => Promise<T>): Promise<T | null> {
      if (pending) return null;
      pending = true;
      try {
        return await task();
      } finally {
        pending = false;
      }
    }
  };
}
