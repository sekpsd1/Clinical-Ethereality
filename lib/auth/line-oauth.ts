export const lineOAuthCookieNames = {
  state: "line_oauth_state",
  next: "line_oauth_next"
} as const;

function pathStartsWith(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function normalizeLineAuthNextPath(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return "/auth/role-home";
  }

  const pathname = value.split(/[?#]/, 1)[0];
  return pathStartsWith(pathname, "/auth/line") || pathStartsWith(pathname, "/api/auth/line") || pathname === "/api/auth/refresh"
    ? "/auth/role-home"
    : value;
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
