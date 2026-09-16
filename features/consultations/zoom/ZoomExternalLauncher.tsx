"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";

const HANDOFF_TICKET_PATTERN = /^v1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{40,64}$/;

type LaunchResponse = {
  ok?: unknown;
  launchUrl?: unknown;
};

type LaunchState = "idle" | "preparing" | "error";

export function isLineInAppBrowser(userAgent: string): boolean {
  return /\bLine\/[0-9.]+/i.test(userAgent);
}

export function isAndroidUserAgent(userAgent: string): boolean {
  return /\bAndroid\b/i.test(userAgent);
}

export function isTrustedZoomLaunchUrl(value: string, currentOrigin: string): boolean {
  try {
    const url = new URL(value);
    const ticket = new URLSearchParams(url.hash.slice(1)).get("handoff")?.trim();

    return (
      url.origin === currentOrigin &&
      url.pathname === "/zoom-sdk/index.html" &&
      url.searchParams.has("consultation") &&
      !url.searchParams.has("handoff") &&
      url.hash.startsWith("#handoff=") &&
      Boolean(ticket && HANDOFF_TICKET_PATTERN.test(ticket))
    );
  } catch {
    return false;
  }
}

export function buildIosLineExternalBrowserUrl(value: string, currentOrigin: string): string | null {
  if (!isTrustedZoomLaunchUrl(value, currentOrigin)) {
    return null;
  }

  const url = new URL(value);
  url.searchParams.set("openExternalBrowser", "1");
  return url.toString();
}

export function buildAndroidLineChromeIntentUrl(value: string, currentOrigin: string): string | null {
  if (!isTrustedZoomLaunchUrl(value, currentOrigin)) {
    return null;
  }

  const url = new URL(value);
  const fallbackUrl = url.toString();

  return `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
}

export function getZoomLaunchTarget(value: string, currentOrigin: string, userAgent: string): string | null {
  if (!isTrustedZoomLaunchUrl(value, currentOrigin)) {
    return null;
  }

  if (!isLineInAppBrowser(userAgent)) {
    return value;
  }

  return isAndroidUserAgent(userAgent)
    ? buildAndroidLineChromeIntentUrl(value, currentOrigin)
    : buildIosLineExternalBrowserUrl(value, currentOrigin);
}

export function navigateToZoomLaunchTarget(
  launchTarget: string,
  safeFallbackUrl: string,
  navigation: {
    assign: (url: string) => void;
    isVisible: () => boolean;
    schedule: (callback: () => void, delayMs: number) => void;
  }
) {
  if (!launchTarget.startsWith("intent://")) {
    navigation.assign(launchTarget);
    return;
  }

  try {
    navigation.assign(launchTarget);
    navigation.schedule(() => {
      if (navigation.isVisible()) {
        navigation.assign(safeFallbackUrl);
      }
    }, 1_200);
  } catch {
    navigation.assign(safeFallbackUrl);
  }
}

export function ZoomExternalLauncher({
  consultationId,
  compact = false,
  waitingRoom = false,
  autoLaunch = false
}: {
  consultationId: string;
  compact?: boolean;
  waitingRoom?: boolean;
  autoLaunch?: boolean;
}) {
  const [state, setState] = useState<LaunchState>("idle");
  const [message, setMessage] = useState("ระบบจะเปิดเบราว์เซอร์ภายนอกเพื่อตรวจกล้องและไมค์ก่อนเข้าห้อง");
  const launchInFlight = useRef(false);
  const requestId = useRef<string | null>(null);

  const openZoom = useCallback(async () => {
    if (launchInFlight.current) {
      return;
    }

    launchInFlight.current = true;
    setState("preparing");
    setMessage("กำลังสร้างสิทธิ์เข้าห้องแบบใช้ครั้งเดียว...");

    try {
      requestId.current ??= window.crypto?.randomUUID?.() ?? null;
      const headers: Record<string, string> = {
        Accept: "application/json"
      };

      if (requestId.current) {
        headers["Idempotency-Key"] = requestId.current;
      }

      const response = await fetch(`/api/consultations/${encodeURIComponent(consultationId)}/zoom-handoff`, {
        method: "POST",
        credentials: "same-origin",
        headers
      });
      const payload = (await response.json()) as LaunchResponse;
      const safeLaunchUrl =
        typeof payload.launchUrl === "string" &&
        isTrustedZoomLaunchUrl(payload.launchUrl, window.location.origin)
          ? payload.launchUrl
          : null;
      const launchTarget =
        safeLaunchUrl
          ? getZoomLaunchTarget(safeLaunchUrl, window.location.origin, window.navigator.userAgent)
          : null;

      if (!response.ok || payload.ok !== true || !safeLaunchUrl || !launchTarget) {
        throw new Error("zoom_handoff_unavailable");
      }

      navigateToZoomLaunchTarget(launchTarget, safeLaunchUrl, {
        assign: (url) => window.location.assign(url),
        isVisible: () => document.visibilityState === "visible",
        schedule: (callback, delayMs) => {
          window.setTimeout(callback, delayMs);
        }
      });
      return;
    } catch {
      launchInFlight.current = false;
      setState("error");
      setMessage("ยังเปิดเบราว์เซอร์ภายนอกไม่ได้ กรุณาลองใหม่หรือเลือก “เปิดในเบราว์เซอร์” จากเมนู LINE");
    }
  }, [consultationId]);

  useEffect(() => {
    if (autoLaunch) {
      void openZoom();
    }
  }, [autoLaunch, openZoom]);

  if (autoLaunch) {
    return (
      <div className="flex flex-col items-end gap-2">
        <p className="text-[11px] font-semibold leading-4 text-muted" role="status">
          {message}
        </p>
        {state === "error" ? (
          <Button type="button" size="sm" onClick={openZoom}>
            <ExternalLink aria-hidden="true" className="size-4" strokeWidth={2.2} />
            ลองเปิด Zoom อีกครั้ง
          </Button>
        ) : null}
      </div>
    );
  }

  if (waitingRoom) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          size="lg"
          onClick={openZoom}
          disabled={state === "preparing"}
          className="w-full py-5 text-lg shadow-booking"
        >
          <ExternalLink aria-hidden="true" className="size-5" strokeWidth={2.2} />
          {state === "preparing" ? "กำลังเปิดห้องปรึกษา..." : "เข้าสู่ห้องปรึกษา"}
        </Button>
        <p className="text-center text-[11px] leading-4 text-[#3e494a]" role="status">
          {message}
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <>
        <div className="pointer-events-none relative z-10 col-start-1 row-start-1">
          <div className="absolute left-1/2 top-[43%] flex w-[76%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-center">
            <p className="rounded-md bg-black/55 px-3 py-1.5 text-[10px] font-semibold leading-4 text-white" role="status">
              {message}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="lg"
          onClick={openZoom}
          disabled={state === "preparing"}
          className="col-start-1 row-start-2 mt-3 w-full"
        >
          <ExternalLink aria-hidden="true" className="size-5" strokeWidth={2.2} />
          {state === "preparing" ? "กำลังเตรียมห้อง Zoom..." : "เริ่มวิดีโอคอลกับแพทย์"}
        </Button>
      </>
    );
  }

  return (
    <div className="rounded-[8px] border border-primary/15 bg-white/80 p-5 text-center shadow-payment-card">
      <h1 className="font-headline text-xl font-bold text-text">เปิด Zoom อย่างปลอดภัย</h1>
      <p className="mt-2 text-xs leading-5 text-muted" role="status">{message}</p>
      <button
        type="button"
        onClick={openZoom}
        disabled={state === "preparing"}
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white disabled:opacity-60"
      >
        {state === "preparing" ? "กำลังเตรียม..." : "เริ่มวิดีโอคอลกับแพทย์"}
      </button>
    </div>
  );
}
