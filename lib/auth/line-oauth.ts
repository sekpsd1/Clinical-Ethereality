export const lineOAuthCookieNames = {
  state: "line_oauth_state",
  next: "line_oauth_next"
} as const;

export function normalizeLineAuthNextPath(value: string | null | undefined): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/consult/assessment";
}

export function getPublicAppOrigin(fallbackOrigin: string): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!configuredUrl) {
    return fallbackOrigin;
  }

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return fallbackOrigin;
  }
}

export function getLineOAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60
  };
}
