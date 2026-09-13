import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  buildAndroidRecordingChromeIntentUrl,
  buildIosRecordingExternalBrowserUrl,
  createRecordingHandoffRequestGate,
  exchangeRecordingHandoffSession,
  getProtectedRecordingUrl,
  getRecordingHandoffDescriptor,
  getRecordingHandoffTicket,
  getRecordingLaunchTarget,
  getSanitizedRecordingHandoffPath,
  isTrustedRecordingLaunchUrl,
  requestRecordingHandoff
} from "@/features/consultations/recordings/recording-handoff-client";

const ticket = `v1.00000000-0000-4000-8000-000000000000.${"a".repeat(43)}`;
const descriptor = {
  consultationId: "consultation-1",
  recordingId: "recording-1",
  mode: "view" as const
};
const launchUrl = `https://app.example.test/recordings/handoff?consultation=consultation-1&recording=recording-1&mode=view#handoff=${ticket}`;

describe("recording external handoff client", () => {
  it("accepts only a same-origin exact-scope fragment launch URL", () => {
    expect(isTrustedRecordingLaunchUrl(launchUrl, "https://app.example.test", descriptor)).toBe(true);
    expect(getRecordingHandoffTicket(`#handoff=${ticket}`)).toBe(ticket);
    expect(getRecordingHandoffTicket(`?handoff=${ticket}`)).toBeNull();
    expect(
      isTrustedRecordingLaunchUrl(
        launchUrl.replace("app.example.test", "attacker.example"),
        "https://app.example.test",
        descriptor
      )
    ).toBe(false);
    expect(
      isTrustedRecordingLaunchUrl(
        launchUrl.replace("mode=view", "mode=download"),
        "https://app.example.test",
        descriptor
      )
    ).toBe(false);
    expect(
      isTrustedRecordingLaunchUrl(
        launchUrl.replace("#handoff=", `&handoff=${ticket}#handoff=`),
        "https://app.example.test",
        descriptor
      )
    ).toBe(false);
  });

  it("uses the explicit Android Chrome intent and existing iOS external-browser pattern", () => {
    const intent = buildAndroidRecordingChromeIntentUrl(launchUrl);
    expect(intent).toContain("#Intent;scheme=https;package=com.android.chrome;");
    expect(intent).toContain(encodeURIComponent(`#handoff=${ticket}`));
    expect(intent).not.toContain(`?handoff=${ticket}`);

    const ios = buildIosRecordingExternalBrowserUrl(
      launchUrl,
      "https://app.example.test",
      descriptor
    );
    expect(new URL(ios ?? "").searchParams.get("openExternalBrowser")).toBe("1");
    expect(new URL(ios ?? "").hash).toBe(`#handoff=${ticket}`);
    expect(
      getRecordingLaunchTarget(
        launchUrl,
        "https://app.example.test",
        "Mozilla/5.0 (iPhone) Line/15.20.1",
        descriptor
      )
    ).toBe(ios);
    expect(
      getRecordingLaunchTarget(
        launchUrl,
        "https://app.example.test",
        "Mozilla/5.0 (Linux; Android 15) Line/15.20.1",
        descriptor
      )
    ).toBe(launchUrl);
  });

  it("strips the fragment before exchange and builds the exact protected endpoint", () => {
    expect(getSanitizedRecordingHandoffPath(launchUrl)).toBe(
      "/recordings/handoff?consultation=consultation-1&recording=recording-1&mode=view"
    );
    expect(getRecordingHandoffDescriptor(launchUrl)).toEqual(descriptor);
    expect(getProtectedRecordingUrl(descriptor)).toBe(
      "/api/consultations/consultation-1/recordings/recording-1"
    );
    expect(getProtectedRecordingUrl({ ...descriptor, mode: "download" })).toBe(
      "/api/consultations/consultation-1/recordings/recording-1?download=1"
    );
  });

  it("requests a fresh handoff for each action and rejects untrusted server URLs", async () => {
    const fetchHandoff = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, launchUrl })
    });
    await expect(
      requestRecordingHandoff(descriptor, "https://app.example.test", "Mozilla/5.0", fetchHandoff)
    ).resolves.toBe(launchUrl);
    await expect(
      requestRecordingHandoff(descriptor, "https://app.example.test", "Mozilla/5.0", fetchHandoff)
    ).resolves.toBe(launchUrl);
    expect(fetchHandoff).toHaveBeenCalledTimes(2);

    fetchHandoff.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, launchUrl: launchUrl.replace("app.example.test", "attacker.example") })
    });
    await expect(
      requestRecordingHandoff(descriptor, "https://app.example.test", "Mozilla/5.0", fetchHandoff)
    ).rejects.toThrow("recording_handoff_unavailable");
  });

  it("prevents duplicate clicks while a request is pending and permits a later retry", async () => {
    const gate = createRecordingHandoffRequestGate();
    let release!: () => void;
    const task = vi.fn(() => new Promise<string>((resolve) => {
      release = () => resolve("ok");
    }));

    const first = gate.run(task);
    await expect(gate.run(task)).resolves.toBeNull();
    expect(task).toHaveBeenCalledOnce();
    release();
    await expect(first).resolves.toBe("ok");

    await expect(gate.run(async () => "retry")).resolves.toBe("retry");
  });

  it("exchanges the fragment ticket by same-origin POST with the exact scope", async () => {
    const fetchSession = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, ...descriptor })
    });

    await expect(
      exchangeRecordingHandoffSession(descriptor, `#handoff=${ticket}`, fetchSession)
    ).resolves.toBeUndefined();
    expect(fetchSession).toHaveBeenCalledWith(
      "/api/recordings/handoff/session",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({ ticket, ...descriptor })
      })
    );
    await expect(exchangeRecordingHandoffSession(descriptor, "", fetchSession)).rejects.toThrow(
      "recording_handoff_invalid"
    );
  });

  it("keeps the public landing generic and free of patient or provider details", () => {
    const source = readFileSync(
      "features/consultations/recordings/RecordingExternalHandoffPage.tsx",
      "utf8"
    );
    expect(source).toContain("กลับไปที่ LINE แล้วกดเปิดไฟล์ใหม่อีกครั้ง");
    expect(source).not.toMatch(/patient|displayName|providerRecordingId|download_url/i);
    expect(source).toContain("window.history.replaceState");
  });
});
