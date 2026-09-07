import { describe, expect, it, vi } from "vitest";
import {
  establishZoomExternalSession,
  getHandoffTicket
} from "../../zoom-client/src/handoff";
import {
  isLineInAppBrowser,
  isTrustedZoomLaunchUrl
} from "@/features/consultations/zoom/ZoomExternalLauncher";

describe("Zoom external-browser client helpers", () => {
  it("recognizes LINE's in-app user agent and accepts only same-origin handoff URLs", () => {
    expect(isLineInAppBrowser("Mozilla/5.0 Line/15.20.1")).toBe(true);
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
