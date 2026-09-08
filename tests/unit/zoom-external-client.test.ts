import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildAndroidChromeIntentUrl,
  establishZoomExternalSession,
  getHandoffTicket,
  getSanitizedHandoffPath,
  isLineInAppBrowser as isZoomClientLineBrowser
} from "../../zoom-client/src/handoff";
import {
  buildIosLineExternalBrowserUrl,
  getSafeIosLiffFailureCode,
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
    const zoomClientSource = fs.readFileSync(path.join(process.cwd(), "zoom-client", "src", "main.ts"), "utf8");
    const livePageSource = fs.readFileSync(
      path.join(process.cwd(), "app", "(app)", "consult", "live", "page.tsx"),
      "utf8"
    );

    expect(launcherSource).not.toContain("process.env.NEXT_PUBLIC_LINE_LIFF_ID");
    expect(launcherSource).toContain("liffId?: string");
    expect(launcherSource.match(/onClick=\{openZoom\}/g)).toHaveLength(3);
    expect(launcherSource).toContain("เริ่มวิดีโอคอลกับแพทย์");
    expect(launcherSource).toContain("col-start-1 row-start-2");
    expect(zoomClientSource).toContain("วิดีโอคอลปรึกษาแพทย์");
    expect(zoomClientSource).toContain("กดปุ่มด้านล่างเพื่อเปิดเบราว์เซอร์และเริ่มวิดีโอคอล");
    expect(zoomClientSource).toContain("เปิดวิดีโอคอลใน Chrome");
    expect(livePageSource).toContain("getAppEnv().NEXT_PUBLIC_LINE_LIFF_ID");
    expect(livePageSource).toContain("liffId={liffId}");
  });

  it("recognizes LINE's in-app user agent and accepts only same-origin handoff URLs", () => {
    const ticket = `v1.00000000-0000-4000-8000-000000000000.${"a".repeat(43)}`;

    expect(isLineInAppBrowser("Mozilla/5.0 Line/15.20.1")).toBe(true);
    expect(isAndroidUserAgent("Mozilla/5.0 (Linux; Android 15) Line/15.20.1")).toBe(true);
    expect(isAndroidUserAgent("Mozilla/5.0 (iPhone) Line/15.20.1")).toBe(false);
    expect(isZoomClientLineBrowser("Mozilla/5.0 (Linux; Android 15) Line/15.20.1")).toBe(true);
    expect(isZoomClientLineBrowser("Mozilla/5.0 Chrome/140.0")).toBe(false);
    expect(isLineInAppBrowser("Mozilla/5.0 Chrome/140.0")).toBe(false);
    expect(
      isTrustedZoomLaunchUrl(
        `https://app.example.test/zoom-sdk/index.html?consultation=consultation-1#handoff=${ticket}`,
        "https://app.example.test"
      )
    ).toBe(true);
    expect(
      isTrustedZoomLaunchUrl(
        `https://attacker.example/zoom-sdk/index.html?consultation=consultation-1#handoff=${ticket}`,
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

    expect(intentUrl).toContain(
      `intent://app.example.test/zoom-sdk/index.html?consultation=consultation-1#handoff=${ticket}#Intent;`
    );
    expect(intentUrl).not.toContain(`?handoff=${ticket}`);
    expect(intentUrl).not.toContain(`&handoff=${ticket}`);
    expect(intentUrl).toContain("#Intent;scheme=https;package=com.android.chrome;");
    expect(intentUrl).toContain("S.browser_fallback_url=https%3A%2F%2Fapp.example.test%2Fzoom-sdk%2Findex.html");
    expect(intentUrl).toContain(encodeURIComponent(`#handoff=${ticket}`));
    expect(intentUrl).toMatch(/;end$/);

    const intentData = intentUrl?.slice("intent://".length, intentUrl.lastIndexOf("#Intent;"));
    const chromeTarget = new URL(`https://${intentData}`);
    const fallback = /S\.browser_fallback_url=([^;]+);/.exec(intentUrl ?? "")?.[1];
    const fallbackTarget = new URL(decodeURIComponent(fallback ?? ""));

    expect(chromeTarget.searchParams.has("handoff")).toBe(false);
    expect(chromeTarget.hash).toBe(`#handoff=${ticket}`);
    expect(fallbackTarget.searchParams.has("handoff")).toBe(false);
    expect(fallbackTarget.hash).toBe(`#handoff=${ticket}`);
  });

  it("builds a safe iPhone LINE fallback without moving the one-time ticket into the query", () => {
    const ticket = `v1.00000000-0000-4000-8000-000000000000.${"a".repeat(43)}`;
    const fallbackUrl = buildIosLineExternalBrowserUrl(
      `https://app.example.test/zoom-sdk/index.html?consultation=consultation-1#handoff=${ticket}`,
      "https://app.example.test"
    );
    const parsed = new URL(fallbackUrl ?? "");

    expect(parsed.searchParams.get("openExternalBrowser")).toBe("1");
    expect(parsed.searchParams.has("handoff")).toBe(false);
    expect(parsed.hash).toBe(`#handoff=${ticket}`);
    expect(
      buildIosLineExternalBrowserUrl(
        `https://attacker.example/zoom-sdk/index.html?consultation=consultation-1#handoff=${ticket}`,
        "https://app.example.test"
      )
    ).toBeNull();
    expect(
      buildIosLineExternalBrowserUrl(
        `https://app.example.test/zoom-sdk/index.html?consultation=consultation-1&handoff=${ticket}#handoff=${ticket}`,
        "https://app.example.test"
      )
    ).toBeNull();
  });

  it("reports only allowlisted iPhone LIFF failure codes", () => {
    expect(getSafeIosLiffFailureCode(new Error("ios_liff_init_failed"))).toBe("LIFF_INIT_FAILED");
    expect(getSafeIosLiffFailureCode(new Error("ios_liff_context_unavailable"))).toBe("LIFF_CONTEXT_UNAVAILABLE");
    expect(getSafeIosLiffFailureCode(new Error("ticket=v1.secret patient=private"))).toBeNull();
    expect(getSafeIosLiffFailureCode({ message: "ios_liff_open_failed" })).toBeNull();
  });

  it("accepts a fragment ticket from Android Chrome and rejects query/request URL tickets", () => {
    const ticket = `v1.00000000-0000-4000-8000-000000000000.${"a".repeat(43)}`;

    expect(getHandoffTicket(`#handoff=${ticket}`)).toBe(ticket);
    expect(getHandoffTicket(`?consultation=consultation-1&handoff=${ticket}`)).toBeNull();
    expect(getHandoffTicket(`handoff=${ticket}`)).toBeNull();
    expect(getHandoffTicket(`#handoff=${ticket}#Intent;scheme=https;end`)).toBeNull();
  });

  it("removes fragment and legacy query tickets from browser-visible history before exchange", () => {
    const ticket = `v1.00000000-0000-4000-8000-000000000000.${"a".repeat(43)}`;

    expect(
      getSanitizedHandoffPath(
        `https://app.example.test/zoom-sdk/index.html?consultation=consultation-1#handoff=${ticket}`
      )
    ).toBe("/zoom-sdk/index.html?consultation=consultation-1");
    expect(
      getSanitizedHandoffPath(
        `https://app.example.test/zoom-sdk/index.html?consultation=consultation-1&handoff=${ticket}`
      )
    ).toBe("/zoom-sdk/index.html?consultation=consultation-1");
    expect(
      getSanitizedHandoffPath(
        "https://app.example.test/zoom-sdk/index.html?consultation=consultation-1"
      )
    ).toBeNull();
  });

  it("rejects Android intent input that already contains a query ticket", () => {
    const ticket = `v1.00000000-0000-4000-8000-000000000000.${"a".repeat(43)}`;

    expect(
      buildAndroidChromeIntentUrl(
        `https://app.example.test/zoom-sdk/index.html?consultation=consultation-1&handoff=${ticket}#handoff=${ticket}`
      )
    ).toBeNull();
    expect(
      isTrustedZoomLaunchUrl(
        `https://app.example.test/zoom-sdk/index.html?consultation=consultation-1&handoff=${ticket}#handoff=${ticket}`,
        "https://app.example.test"
      )
    ).toBe(false);
    expect(
      isTrustedZoomLaunchUrl(
        `https://app.example.test/zoom-sdk/index.html?consultation=consultation-1#handoff=${ticket}#Intent;scheme=https;end`,
        "https://app.example.test"
      )
    ).toBe(false);
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
