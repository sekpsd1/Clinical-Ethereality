import { getPublicAppOrigin } from "@/lib/auth/line-oauth";

export function hasTrustedDoctorInviteOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === getPublicAppOrigin(new URL(request.url).origin);
  } catch {
    return false;
  }
}

export const doctorInvitePrivateHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
} as const;
