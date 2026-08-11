import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { ZOOM_SDK_CONTENT_SECURITY_POLICY } from "../../lib/zoom/csp";

describe("Zoom SDK CSP", () => {
  it("scopes Zoom's required CSP policy to the static SDK path only", async () => {
    const headers = await nextConfig.headers?.();

    expect(headers).toHaveLength(1);
    expect(headers?.[0]).toEqual({
      source: "/zoom-sdk/:path*",
      headers: [
        {
          key: "Content-Security-Policy",
          value: ZOOM_SDK_CONTENT_SECURITY_POLICY,
        },
      ],
    });
  });

  it("contains the official Meeting SDK browser-support directives", () => {
    expect(ZOOM_SDK_CONTENT_SECURITY_POLICY).toContain("worker-src blob:");
    expect(ZOOM_SDK_CONTENT_SECURITY_POLICY).toContain("'unsafe-eval'");
    expect(ZOOM_SDK_CONTENT_SECURITY_POLICY).toContain("wss://*.zoom.us");
  });
});
