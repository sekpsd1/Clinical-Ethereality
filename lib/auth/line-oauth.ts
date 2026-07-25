export const lineOAuthCookieNames = {
  state: "line_oauth_state",
  next: "line_oauth_next"
} as const;

export function normalizeLineAuthNextPath(value: string | null | undefined): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/consult/assessment";
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
