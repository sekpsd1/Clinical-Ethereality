"use client";

import { useState } from "react";
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

export function getZoomLaunchTarget(value: string, currentOrigin: string, userAgent: string): string | null {
  if (!isTrustedZoomLaunchUrl(value, currentOrigin)) {
    return null;
  }

  return isLineInAppBrowser(userAgent) && !isAndroidUserAgent(userAgent)
    ? buildIosLineExternalBrowserUrl(value, currentOrigin)
    : value;
}

export function ZoomExternalLauncher({
  consultationId,
  compact = false
}: {
  consultationId: string;
  compact?: boolean;
}) {
  const [state, setState] = useState<LaunchState>("idle");
  const [message, setMessage] = useState("ระบบจะเปิดเบราว์เซอร์ภายนอกเพื่อตรวจกล้องและไมค์ก่อนเข้าห้อง");

  async function openZoom() {
    if (state === "preparing") {
      return;
    }

    setState("preparing");
    setMessage("กำลังสร้างสิทธิ์เข้าห้องแบบใช้ครั้งเดียว...");

    try {
      const response = await fetch(`/api/consultations/${encodeURIComponent(consultationId)}/zoom-handoff`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = (await response.json()) as LaunchResponse;
      const launchTarget =
        typeof payload.launchUrl === "string"
          ? getZoomLaunchTarget(payload.launchUrl, window.location.origin, window.navigator.userAgent)
          : null;

      if (!response.ok || payload.ok !== true || !launchTarget) {
        throw new Error("zoom_handoff_unavailable");
      }

      window.location.assign(launchTarget);
      return;

    } catch {
      setState("error");
      setMessage("ยังเปิดเบราว์เซอร์ภายนอกไม่ได้ กรุณาลองใหม่หรือเลือก “เปิดในเบราว์เซอร์” จากเมนู LINE");
    }
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
