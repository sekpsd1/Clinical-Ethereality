import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildAndroidChromeIntentUrl,
  establishZoomExternalSession,
  getHandoffTicket,
  isLineInAppBrowser as isZoomClientLineBrowser
} from "../../zoom-client/src/handoff";
import {
  isAndroidUserAgent,
  isLineInAppBrowser,
  isTrustedZoomLaunchUrl
} from "@/features/consultations/zoom/ZoomExternalLauncher";

describe("Zoom external-browser client helpers", () => {
  it("receives the LIFF ID from a runtime server prop instead of a client build-time environment lookup", () => {
    const launcherSource = fs.readFileSync(
      path.join(process.cwd(), "features", "consultations", "zoom", "ZoomExternalLauncher.tsx"),
      "utf8"
    );
    const livePageSource = fs.readFileSync(
      path.join(process.cwd(), "app", "(app)", "consult", "live", "page.tsx"),
      "utf8"
    );

    expect(launcherSource).not.toContain("process.env.NEXT_PUBLIC_LINE_LIFF_ID");
    expect(launcherSource).toContain("liffId?: string");
    expect(livePageSource).toContain("getAppEnv().NEXT_PUBLIC_LINE_LIFF_ID");
    expect(livePageSource).toContain("liffId={liffId}");
  });

  it("recognizes LINE's in-app user agent and accepts only same-origin handoff URLs", () => {
    expect(isLineInAppBrowser("Mozilla/5.0 Line/15.20.1")).toBe(true);
    expect(isAndroidUserAgent("Mozilla/5.0 (Linux; Android 15) Line/15.20.1")).toBe(true);
    expect(isAndroidUserAgent("Mozilla/5.0 (iPhone) Line/15.20.1")).toBe(false);
    expect(isZoomClientLineBrowser("Mozilla/5.0 (Linux; Android 15) Line/15.20.1")).toBe(true);
    expect(isZoomClientLineBrowser("Mozilla/5.0 Chrome/140.0")).toBe(false);
    expect(isLineInAppBrowser("Mozilla/5.0 Chrome/140.0")).toBe(false);
    expect(
      isTrustedZoomLaunchUrl(
        "https://app.example.test/zoom-sdk/index.html?consultation=consultation-1#handoff=v1.token",
        "https://app.example.test"
      )
    ).toBe(true);
    expect(
      isTrustedZoomLaunchUrl(
        "https://attacker.example/zoom-sdk/index.html?consultation=consultation-1#handoff=v1.token",
        "https://app.example.test"
      )
    ).toBe(false);
  });

  it("sends a fragment ticket in a same-origin POST and never puts it in a request URL", async () => {
    const ticket = `v1.00000000-0000-4000-8000-000000000000.${"a".repeat(43)}`;
    const fetchSession = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, consultationId: "consultation-1" })
    });

    await expect(
      establishZoomExternalSession("consultation-1", `#handoff=${ticket}`, fetchSession)
    ).resolves.toEqual({ exchanged: true });
    expect(getHandoffTicket(`#handoff=${ticket}`)).toBe(ticket);
    expect(fetchSession.mock.calls[0]?.[0]).toBe("/api/zoom/handoff/session");
    expect(fetchSession.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      body: JSON.stringify({ ticket })
    });
  });

  it("builds a direct Android Chrome intent when LINE omits its open-browser menu", () => {
    const ticket = `v1.00000000-0000-4000-8000-000000000000.${"a".repeat(43)}`;
    const intentUrl = buildAndroidChromeIntentUrl(
      `https://app.example.test/zoom-sdk/index.html?consultation=consultation-1#handoff=${ticket}`
    );

    expect(intentUrl).toContain("intent://app.example.test/zoom-sdk/index.html?");
    expect(intentUrl).toContain(`consultation=consultation-1&handoff=${ticket}`);
    expect(intentUrl).toContain("#Intent;scheme=https;package=com.android.chrome;");
    expect(intentUrl).toContain("S.browser_fallback_url=https%3A%2F%2Fapp.example.test%2Fzoom-sdk%2Findex.html");
    expect(intentUrl).toMatch(/;end$/);
  });

  it("accepts the one-time ticket from the Android Chrome intent query", () => {
    const ticket = `v1.00000000-0000-4000-8000-000000000000.${"a".repeat(43)}`;

    expect(getHandoffTicket(`?consultation=consultation-1&handoff=${ticket}`)).toBe(ticket);
  });

  it("validates an existing scoped cookie on reload without replaying the ticket", async () => {
    const fetchSession = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, consultationId: "consultation-1" })
    });

    await expect(establishZoomExternalSession("consultation-1", "", fetchSession)).resolves.toEqual({
      exchanged: false
    });
    expect(fetchSession).toHaveBeenCalledWith(
      "/api/zoom/handoff/session?consultation=consultation-1",
      expect.objectContaining({ credentials: "same-origin" })
    );
  });

  it("recovers when the one-time exchange response is lost but the scoped cookie was already set", async () => {
    const ticket = `v1.00000000-0000-4000-8000-000000000000.${"a".repeat(43)}`;
    const fetchSession = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ ok: false })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, consultationId: "consultation-1" })
      });

    await expect(
      establishZoomExternalSession("consultation-1", `#handoff=${ticket}`, fetchSession)
    ).resolves.toEqual({ exchanged: true });
    expect(fetchSession.mock.calls[1]?.[0]).toBe(
      "/api/zoom/handoff/session?consultation=consultation-1"
    );
  });
});
