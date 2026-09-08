type SessionResponse = {
  ok?: unknown;
  consultationId?: unknown;
};

const HANDOFF_TICKET_PATTERN = /^v1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{40,64}$/;

export type FetchSession = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "json">>;

export function getHandoffTicket(fragment: string): string | null {
  if (!fragment.startsWith("#")) {
    return null;
  }

  const value = new URLSearchParams(fragment.slice(1)).get("handoff")?.trim();

  return value && HANDOFF_TICKET_PATTERN.test(value) ? value : null;
}

export function getSanitizedHandoffPath(currentUrl: string): string | null {
  try {
    const target = new URL(currentUrl);

    if (!target.searchParams.has("handoff") && !target.hash.startsWith("#handoff=")) {
      return null;
    }

    target.searchParams.delete("handoff");
    target.hash = "";

    return `${target.pathname}${target.search}`;
  } catch {
    return null;
  }
}

export function buildAndroidChromeIntentUrl(currentUrl: string): string | null {
  try {
    const target = new URL(currentUrl);
    const ticket = getHandoffTicket(target.hash);

    if (
      target.protocol !== "https:" ||
      target.pathname !== "/zoom-sdk/index.html" ||
      !target.searchParams.has("consultation") ||
      target.searchParams.has("handoff") ||
      !ticket
    ) {
      return null;
    }

    const fallbackUrl = target.toString();

    return `intent://${target.host}${target.pathname}${target.search}${target.hash}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
  } catch {
    return null;
  }
}

export function isLineInAppBrowser(userAgent: string): boolean {
  return /\bLine\/[0-9.]+/i.test(userAgent);
}

export async function establishZoomExternalSession(
  consultationId: string,
  hash: string,
  fetchSession: FetchSession = fetch
): Promise<{ exchanged: boolean }> {
  const ticket = getHandoffTicket(hash);
  const validateExistingSession = async () => {
    const response = await fetchSession(
      `/api/zoom/handoff/session?consultation=${encodeURIComponent(consultationId)}`,
      {
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      }
    );
    const payload = (await response.json()) as SessionResponse;
    return response.ok && payload.ok === true && payload.consultationId === consultationId;
  };

  if (!ticket) {
    if (!(await validateExistingSession())) {
      throw new Error("zoom_external_session_invalid");
    }

    return { exchanged: false };
  }

  const exchangeResponse = await fetchSession("/api/zoom/handoff/session", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ticket })
  });
  const exchangePayload = (await exchangeResponse.json()) as SessionResponse;

  if (
    !exchangeResponse.ok ||
    exchangePayload.ok !== true ||
    exchangePayload.consultationId !== consultationId
  ) {
    if (!(await validateExistingSession())) {
      throw new Error("zoom_external_session_invalid");
    }
  }

  return { exchanged: true };
}
