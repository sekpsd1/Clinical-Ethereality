/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, expect, it, vi } from "vitest";

const {
  getZoomTestZakReadiness,
  httpCategory
} = require("../../scripts/zoom-test-zak-readiness-probe.cjs");

const environment = {
  NODE_ENV: "production",
  CE_DEPLOYMENT_ENVIRONMENT: "test",
  NEXT_PUBLIC_APP_URL: "https://test-app.bccgroup-thailand.com",
  ZOOM_ACCOUNT_ID: "test-account",
  ZOOM_CLIENT_ID: "test-client",
  ZOOM_CLIENT_SECRET: "test-secret",
  ZOOM_HOST_USER_ID: "host@example.test"
};

describe("Zoom Test ZAK readiness probe", () => {
  it("reports only a safe ready category", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "private-access" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ token: "private-zak" }) });

    await expect(getZoomTestZakReadiness({ environment, fetchImpl })).resolves.toEqual({
      status: "ready",
      stage: "zak",
      httpCategory: "2xx"
    });
    expect(JSON.stringify(await getZoomTestZakReadiness({
      environment,
      fetchImpl: vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "private-access" }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ token: "private-zak" }) })
    }))).not.toContain("private-");
  });

  it("reports a safe ZAK HTTP category without response data", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "private-access" }) })
      .mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(getZoomTestZakReadiness({ environment, fetchImpl })).resolves.toEqual({
      status: "not_ready",
      stage: "zak",
      httpCategory: "4xx"
    });
  });

  it("blocks execution outside the exact Test environment", async () => {
    await expect(
      getZoomTestZakReadiness({ environment: { ...environment, CE_DEPLOYMENT_ENVIRONMENT: "production" } })
    ).resolves.toEqual({ status: "blocked", stage: "environment", httpCategory: "none" });
  });

  it("normalizes HTTP status into broad categories", () => {
    expect(httpCategory(200)).toBe("2xx");
    expect(httpCategory(429)).toBe("4xx");
    expect(httpCategory(503)).toBe("5xx");
    expect(httpCategory(0)).toBe("unknown");
  });
});
