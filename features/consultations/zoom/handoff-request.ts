import { getPublicAppOrigin } from "@/lib/auth/line-oauth";

export function hasTrustedZoomHandoffOrigin(request: Request): boolean {
  const requestOrigin = request.headers.get("origin");

  if (!requestOrigin) {
    return false;
  }

  try {
    const expectedOrigin = getPublicAppOrigin(new URL(request.url).origin);
    return new URL(requestOrigin).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export function getRequestIpAddress(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return forwarded && forwarded.length <= 45 ? forwarded : null;
}
