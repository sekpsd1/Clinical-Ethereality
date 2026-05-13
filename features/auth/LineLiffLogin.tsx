"use client";

import { useEffect, useMemo, useState } from "react";

type LiffClient = {
  init: (config: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (config?: { redirectUri?: string }) => void;
  getIDToken: () => string | null;
};

declare global {
  interface Window {
    liff?: LiffClient;
  }
}

type LoginState = "checking" | "redirecting" | "error";

function loadLiffSdk(): Promise<LiffClient> {
  if (window.liff) {
    return Promise.resolve(window.liff);
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://static.line-scdn.net/liff/edge/2/sdk.js"]');

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (window.liff) {
          resolve(window.liff);
        } else {
          reject(new Error("LINE LIFF SDK did not initialize."));
        }
      });
      existingScript.addEventListener("error", () => reject(new Error("Unable to load LINE LIFF SDK.")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    script.async = true;
    script.onload = () => {
      if (window.liff) {
        resolve(window.liff);
      } else {
        reject(new Error("LINE LIFF SDK did not initialize."));
      }
    };
    script.onerror = () => reject(new Error("Unable to load LINE LIFF SDK."));
    document.head.appendChild(script);
  });
}

export function LineLiffLogin({ allowDevBypass, nextPath }: { allowDevBypass: boolean; nextPath: string }) {
  const [state, setState] = useState<LoginState>("checking");
  const [message, setMessage] = useState("Checking your LINE session...");
  const [devLoadingRole, setDevLoadingRole] = useState<"customer" | "admin" | null>(null);
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
  const safeNextPath = useMemo(() => (nextPath.startsWith("/") ? nextPath : "/consult"), [nextPath]);

  async function createDevSession(role: "customer" | "admin") {
    setDevLoadingRole(role);

    try {
      const response = await fetch("/api/auth/dev-session", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ role })
      });

      if (!response.ok) {
        throw new Error("Local dev bypass is not available.");
      }

      window.location.replace(role === "admin" ? "/admin" : safeNextPath);
    } catch (error) {
      setDevLoadingRole(null);
      setMessage(error instanceof Error ? error.message : "Unable to create a local dev session.");
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function completeLogin() {
      if (!liffId) {
        setState("error");
        setMessage("LINE LIFF is not configured yet.");
        return;
      }

      const refreshResponse = await fetch("/api/auth/refresh", {
        method: "POST"
      }).catch(() => null);

      if (!cancelled && refreshResponse?.ok) {
        window.location.replace(safeNextPath);
        return;
      }

      const liff = await loadLiffSdk();

      if (cancelled) {
        return;
      }

      await liff.init({ liffId });

      if (!liff.isLoggedIn()) {
        setState("redirecting");
        setMessage("Opening LINE login...");
        liff.login({
          redirectUri: window.location.href
        });
        return;
      }

      const idToken = liff.getIDToken();

      if (!idToken) {
        throw new Error("LINE did not return an ID token.");
      }

      const sessionResponse = await fetch("/api/auth/line/session", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ idToken })
      });

      if (!sessionResponse.ok) {
        throw new Error("Unable to create an app session.");
      }

      window.location.replace(safeNextPath);
    }

    completeLogin().catch((error: unknown) => {
      if (cancelled) {
        return;
      }

      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to complete LINE login.");
    });

    return () => {
      cancelled = true;
    };
  }, [liffId, safeNextPath]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-app px-6 text-text">
      <section className="w-full max-w-sm rounded-[24px] border border-white/50 bg-white/80 p-6 text-center shadow-glass backdrop-blur-topbar">
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
          CE
        </div>
        <h1 className="font-headline text-xl font-bold text-primary">Clinical Ethereality</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
        {state !== "error" ? (
          <div className="mx-auto mt-6 size-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-hidden="true" />
        ) : allowDevBypass ? (
          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => createDevSession("customer")}
              disabled={devLoadingRole !== null}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white disabled:opacity-60"
            >
              {devLoadingRole === "customer" ? "Opening..." : "Enter as customer"}
            </button>
            <button
              type="button"
              onClick={() => createDevSession("admin")}
              disabled={devLoadingRole !== null}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-primary/20 bg-white px-5 text-sm font-bold text-primary disabled:opacity-60"
            >
              {devLoadingRole === "admin" ? "Opening..." : "Enter as admin"}
            </button>
            <p className="text-xs leading-5 text-muted">Local development bypass is enabled. Production still requires LINE.</p>
          </div>
        ) : (
          <a
            href="/auth/line"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white"
          >
            Try again
          </a>
        )}
      </section>
    </main>
  );
}
