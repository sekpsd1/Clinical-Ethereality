"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";

const LIFF_SDK_URL = "https://static.line-scdn.net/liff/edge/2/sdk.js";

type LiffClient = {
  init: (config: { liffId: string }) => Promise<void>;
  isInClient: () => boolean;
  openWindow: (params: { url: string; external: boolean }) => void;
};

type LaunchResponse = {
  ok?: unknown;
  launchUrl?: unknown;
};

type LaunchState = "idle" | "preparing" | "launched" | "error";

let liffLoader: Promise<LiffClient> | null = null;

function getLiffWindow(): Window & { liff?: LiffClient } {
  return window as Window & { liff?: LiffClient };
}

export function isLineInAppBrowser(userAgent: string): boolean {
  return /\bLine\/[0-9.]+/i.test(userAgent);
}

export function isAndroidUserAgent(userAgent: string): boolean {
  return /\bAndroid\b/i.test(userAgent);
}

export function isTrustedZoomLaunchUrl(value: string, currentOrigin: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.origin === currentOrigin &&
      url.pathname === "/zoom-sdk/index.html" &&
      url.searchParams.has("consultation") &&
      url.hash.startsWith("#handoff=")
    );
  } catch {
    return false;
  }
}

function loadLiffSdk(): Promise<LiffClient> {
  const liffWindow = getLiffWindow();

  if (liffWindow.liff) {
    return Promise.resolve(liffWindow.liff);
  }

  if (liffLoader) {
    return liffLoader;
  }

  liffLoader = new Promise<LiffClient>((resolve, reject) => {
    const finish = () => {
      if (liffWindow.liff) {
        resolve(liffWindow.liff);
      } else {
        reject(new Error("liff_sdk_unavailable"));
      }
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LIFF_SDK_URL}"]`);

    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("liff_sdk_load_failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = LIFF_SDK_URL;
    script.async = true;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("liff_sdk_load_failed")), { once: true });
    document.head.appendChild(script);
  }).catch((error) => {
    liffLoader = null;
    throw error;
  });

  return liffLoader;
}

export function ZoomExternalLauncher({
  consultationId,
  liffId,
  compact = false
}: {
  consultationId: string;
  liffId?: string;
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

      if (
        !response.ok ||
        payload.ok !== true ||
        typeof payload.launchUrl !== "string" ||
        !isTrustedZoomLaunchUrl(payload.launchUrl, window.location.origin)
      ) {
        throw new Error("zoom_handoff_unavailable");
      }

      if (isLineInAppBrowser(window.navigator.userAgent)) {
        if (isAndroidUserAgent(window.navigator.userAgent)) {
          window.location.assign(payload.launchUrl);
          return;
        }

        const runtimeLiffId = liffId?.trim();

        if (!runtimeLiffId) {
          throw new Error("liff_id_missing");
        }

        const liff = await loadLiffSdk();
        await liff.init({ liffId: runtimeLiffId });

        if (!liff.isInClient()) {
          throw new Error("liff_client_unavailable");
        }

        liff.openWindow({ url: payload.launchUrl, external: true });
      } else {
        window.location.assign(payload.launchUrl);
        return;
      }

      setState("launched");
      setMessage("เปิดเบราว์เซอร์ภายนอกแล้ว หากไม่เห็นหน้าใหม่ให้ลองกดอีกครั้ง");
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
            <button
              type="button"
              onClick={openZoom}
              disabled={state === "preparing"}
              aria-label="เปิดห้อง Zoom ในเบราว์เซอร์ภายนอก"
              className="pointer-events-auto flex size-14 items-center justify-center rounded-lg border border-black/40 bg-black/30 text-[#d7eeee] shadow-qr-inset disabled:opacity-60"
            >
              <span className="ml-1 h-0 w-0 border-y-[15px] border-l-[25px] border-y-transparent border-l-[#d7eeee]" />
            </button>
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
          {state === "preparing"
            ? "กำลังเตรียมห้อง Zoom..."
            : state === "launched"
              ? "เปิด Zoom อีกครั้ง"
              : "เปิด Zoom ในเบราว์เซอร์ภายนอก"}
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
        {state === "preparing" ? "กำลังเตรียม..." : state === "launched" ? "เปิด Zoom อีกครั้ง" : "เปิดเบราว์เซอร์และตรวจอุปกรณ์"}
      </button>
    </div>
  );
}
