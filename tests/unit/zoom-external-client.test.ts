import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildAndroidChromeIntentUrl,
  createZoomCompletionCleanupGate,
  establishZoomExternalSession,
  getHandoffTicket,
  getSanitizedHandoffPath,
  getSafeLineProfileReturnUrl,
  isLineInAppBrowser as isZoomClientLineBrowser,
  leaveZoomExternalSession,
  ZoomExternalLeaveError
} from "../../zoom-client/src/handoff";
import {
  buildIosLineExternalBrowserUrl,
  getZoomLaunchTarget,
  isAndroidUserAgent,
  isLineInAppBrowser,
  isTrustedZoomLaunchUrl
} from "@/features/consultations/zoom/ZoomExternalLauncher";
import { buildLineProfileReturnUrl } from "@/features/consultations/zoom/line-return";

describe("Zoom external-browser client helpers", () => {
  it("uses one shared launch handler without an iOS LIFF dependency or duplicate fallback control", () => {
    const launcherSource = fs.readFileSync(
      path.join(process.cwd(), "features", "consultations", "zoom", "ZoomExternalLauncher.tsx"),
      "utf8"
    );
    const zoomClientSource = fs.readFileSync(path.join(process.cwd(), "zoom-client", "src", "main.ts"), "utf8");

    expect(launcherSource).not.toContain("process.env.NEXT_PUBLIC_LINE_LIFF_ID");
    expect(launcherSource).not.toContain("liff.init");
    expect(launcherSource).not.toContain("liff.openWindow");
    expect(launcherSource).not.toContain("LIFF_CONTEXT_UNAVAILABLE");
    expect(launcherSource.match(/onClick=\{openZoom\}/g)).toHaveLength(2);
    expect(launcherSource.match(/เริ่มวิดีโอคอลกับแพทย์/g)).toHaveLength(2);
    expect(launcherSource).not.toContain("เปิดวิดีโอคอลในเบราว์เซอร์ภายนอก");
    expect(launcherSource).not.toContain('target="_blank"');
    expect(launcherSource).toContain("window.location.assign(launchTarget)");
    expect(launcherSource).toContain("เริ่มวิดีโอคอลกับแพทย์");
    expect(launcherSource).toContain("col-start-1 row-start-2");
    expect(zoomClientSource).toContain("วิดีโอคอลปรึกษาแพทย์");
    expect(zoomClientSource).toContain("กดปุ่มด้านล่างเพื่อเปิดเบราว์เซอร์และเริ่มวิดีโอคอล");
    expect(zoomClientSource).toContain("เปิดวิดีโอคอลใน Chrome");
    expect(zoomClientSource).toContain("ออกจากห้องวิดีโอในเบราว์เซอร์นี้");
    expect(zoomClientSource).toContain("กลับไปหน้าโปรไฟล์ใน LINE");
    expect(zoomClientSource).toContain('sessionState === "left"');
    expect(zoomClientSource).not.toContain('history.replaceState(null, "", "/zoom-sdk/index.html?complete=1")');
    expect(zoomClientSource).not.toContain("/api/auth/logout");
    expect(zoomClientSource).not.toContain("window.close");
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

  it("leaves through a same-origin POST without invoking the normal app logout", async () => {
    const fetchSession = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        revoked: true,
        returnToLineUrl: "https://miniapp.line.me/1234567890-AbcdEfgh/profile"
      })
    });

    await expect(leaveZoomExternalSession(fetchSession)).resolves.toEqual({
      returnToLineUrl: "https://miniapp.line.me/1234567890-AbcdEfgh/profile"
    });
    expect(fetchSession).toHaveBeenCalledWith("/api/zoom/handoff/session/leave", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json"
      }
    });
  });

  it("accepts only a LINE LIFF profile return URL", () => {
    expect(buildLineProfileReturnUrl(" 1234567890-AbcdEfgh ")).toBe(
      "https://miniapp.line.me/1234567890-AbcdEfgh/profile"
    );
    expect(buildLineProfileReturnUrl("not/a/liff-id")).toBeNull();
    expect(getSafeLineProfileReturnUrl("https://miniapp.line.me/1234567890-AbcdEfgh/profile")).toBe(
      "https://miniapp.line.me/1234567890-AbcdEfgh/profile"
    );
    expect(getSafeLineProfileReturnUrl("https://app.example.test/profile")).toBeNull();
    expect(getSafeLineProfileReturnUrl("https://attacker.example/profile")).toBeNull();
    expect(getSafeLineProfileReturnUrl("https://miniapp.line.me/1234567890-AbcdEfgh/profile?next=evil")).toBeNull();
    expect(getSafeLineProfileReturnUrl("https://liff.line.me/1234567890-AbcdEfgh/profile")).toBeNull();
    expect(getSafeLineProfileReturnUrl("javascript:alert(1)")).toBeNull();
  });

  it("distinguishes an unavailable external session from a temporary leave failure", async () => {
    const unavailable = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ ok: false, revoked: false, error: "zoom_external_session_unavailable" })
    });
    const temporary = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ ok: false })
    });

    const unavailableError: unknown = await leaveZoomExternalSession(unavailable).catch((error: unknown) => error);
    const temporaryError: unknown = await leaveZoomExternalSession(temporary).catch((error: unknown) => error);

    expect(unavailableError).toBeInstanceOf(ZoomExternalLeaveError);
    expect(unavailableError).toMatchObject({ code: "unavailable" });
    expect(temporaryError).toBeInstanceOf(ZoomExternalLeaveError);
    expect(temporaryError).toMatchObject({ code: "temporary" });
  });

  it("prevents completion cleanup from invoking leave twice after a successful custom leave", async () => {
    const fetchSession = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        revoked: true,
        returnToLineUrl: "https://miniapp.line.me/1234567890-AbcdEfgh/profile"
      })
    });
    const completionGate = createZoomCompletionCleanupGate();

    await leaveZoomExternalSession(fetchSession);
    completionGate.markLeft();

    if (completionGate.tryStart(true)) {
      await leaveZoomExternalSession(fetchSession);
    }

    expect(fetchSession).toHaveBeenCalledOnce();
  });

  it("allows the built-in Zoom completion path to start cleanup only once", () => {
    const completionGate = createZoomCompletionCleanupGate();

    expect(completionGate.tryStart(false)).toBe(false);
    expect(completionGate.tryStart(true)).toBe(true);
    expect(completionGate.tryStart(true)).toBe(false);
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

  it("routes iPhone LINE externally while preserving the existing Android and web targets", () => {
    const ticket = `v1.00000000-0000-4000-8000-000000000000.${"a".repeat(43)}`;
    const launchUrl = `https://app.example.test/zoom-sdk/index.html?consultation=consultation-1#handoff=${ticket}`;
    const iosTarget = getZoomLaunchTarget(
      launchUrl,
      "https://app.example.test",
      "Mozilla/5.0 (iPhone) Line/15.20.1"
    );

    expect(new URL(iosTarget ?? "").searchParams.get("openExternalBrowser")).toBe("1");
    expect(getZoomLaunchTarget(launchUrl, "https://app.example.test", "Mozilla/5.0 (Linux; Android 15) Line/15.20.1")).toBe(
      launchUrl
    );
    expect(getZoomLaunchTarget(launchUrl, "https://app.example.test", "Mozilla/5.0 Safari/605.1.15")).toBe(launchUrl);
    expect(
      getZoomLaunchTarget(
        launchUrl.replace("app.example.test", "attacker.example"),
        "https://app.example.test",
        "Mozilla/5.0 (iPhone) Line/15.20.1"
      )
    ).toBeNull();
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
