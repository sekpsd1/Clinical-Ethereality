"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizePostLoginPath, resolvePostLoginPath } from "@/features/auth/role-routing";
import { isRole } from "@/lib/permissions/roles";

type LiffClient = {
  init: (config: { liffId: string }) => Promise<void>;
  isInClient: () => boolean;
  isLoggedIn: () => boolean;
  login: (config?: { redirectUri?: string }) => void;
  logout: () => void;
  closeWindow: () => void;
  getIDToken: () => string | null;
  getAccessToken: () => string | null;
};

declare global {
  interface Window {
    liff?: LiffClient;
  }
}

type LoginState = "checking" | "redirecting" | "error";
type DevBypassRole = "customer" | "doctor" | "pharmacist" | "admin";

async function getResponsePostLoginPath(response: Response, requestedPath: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | {
        session?: {
          role?: unknown;
        };
      }
    | null;

  return isRole(payload?.session?.role)
    ? resolvePostLoginPath(payload.session.role, requestedPath)
    : "/auth/role-home";
}

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

export function LineLiffLogin({
  allowDevBypass,
  authError,
  forceRoleSelect,
  liffId,
  nextPath
}: {
  allowDevBypass: boolean;
  authError?: string;
  forceRoleSelect?: boolean;
  liffId?: string;
  nextPath: string;
}) {
  const [state, setState] = useState<LoginState>("checking");
  const [message, setMessage] = useState("Checking your LINE session...");
  const [devLoadingRole, setDevLoadingRole] = useState<DevBypassRole | null>(null);
  const safeNextPath = useMemo(() => normalizePostLoginPath(nextPath), [nextPath]);
  const browserLoginHref = `/api/auth/line/login?next=${encodeURIComponent(safeNextPath)}`;

  async function createDevSession(role: DevBypassRole) {
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

      window.location.replace(await getResponsePostLoginPath(response, safeNextPath));
    } catch (error) {
      setDevLoadingRole(null);
      setMessage(error instanceof Error ? error.message : "Unable to create a local dev session.");
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function completeLogin() {
      if (allowDevBypass) {
        setState("error");
        setMessage(forceRoleSelect ? "เลือกบทบาทลูกค้าเพื่อทดสอบหน้าลูกค้า" : "เลือกบทบาทเพื่อทดสอบระบบในเครื่อง");
        return;
      }

      if (authError) {
        setState("error");
        setMessage(
          authError === "cancelled"
            ? "LINE login was cancelled. Please try again."
            : "Unable to complete LINE login. Please try again."
        );
        return;
      }

      if (!liffId) {
        setState("error");
        setMessage("LINE LIFF is not configured yet.");
        return;
      }

      const refreshResponse = await fetch("/api/auth/refresh", {
        method: "POST"
      }).catch(() => null);

      if (!cancelled && refreshResponse?.ok) {
        window.location.replace(await getResponsePostLoginPath(refreshResponse, safeNextPath));
        return;
      }

      const liff = await loadLiffSdk();

      if (cancelled) {
        return;
      }

      await liff.init({ liffId });

      if (!liff.isInClient()) {
        setState("redirecting");
        setMessage("Opening LINE login...");
        window.location.replace(browserLoginHref);
        return;
      }

      if (!liff.isLoggedIn()) {
        setState("redirecting");
        setMessage("Opening LINE login...");
        liff.login({
          redirectUri: window.location.href
        });
        return;
      }

      const idToken = liff.getIDToken();
      const accessToken = liff.getAccessToken();

      if (!idToken || !accessToken) {
        throw new Error("LINE did not return the required login tokens.");
      }

      const sessionResponse = await fetch("/api/auth/line/session", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ idToken, accessToken })
      });

      if (!sessionResponse.ok) {
        throw new Error("Unable to create an app session.");
      }

      window.location.replace(await getResponsePostLoginPath(sessionResponse, safeNextPath));
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
  }, [allowDevBypass, authError, browserLoginHref, forceRoleSelect, liffId, safeNextPath]);

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
            <button
              type="button"
              onClick={() => createDevSession("doctor")}
              disabled={devLoadingRole !== null}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-primary/20 bg-white px-5 text-sm font-bold text-primary disabled:opacity-60"
            >
              {devLoadingRole === "doctor" ? "Opening..." : "Enter as doctor"}
            </button>
            <button
              type="button"
              onClick={() => createDevSession("pharmacist")}
              disabled={devLoadingRole !== null}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-primary/20 bg-white px-5 text-sm font-bold text-primary disabled:opacity-60"
            >
              {devLoadingRole === "pharmacist" ? "Opening..." : "Enter as pharmacist"}
            </button>
            <p className="text-xs leading-5 text-muted">Local development bypass is enabled. Production still requires LINE.</p>
          </div>
        ) : (
          <a
            href={browserLoginHref}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white"
          >
            Try again
          </a>
        )}
      </section>
    </main>
  );
}
