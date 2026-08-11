import { createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type ZoomJoinData =
  | {
      available: true;
      meetingNumber: string;
      password: string;
      signature: string;
      zak?: string;
      userName: string;
      leaveUrl: string;
    }
  | {
      available: false;
      message: string;
      leaveUrl: string;
    };

type JoinState = "idle" | "joining" | "error";

const INIT_TIMEOUT_MS = 20_000;
const JOIN_TIMEOUT_MS = 20_000;
const SDK_VERSION = "6.2.0";

function getConsultationId() {
  const value = new URLSearchParams(window.location.search).get("consultation")?.trim();

  return value && /^[A-Za-z0-9_-]{8,191}$/.test(value) ? value : null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, stage: "init" | "join" | "i18n") {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${stage}_timeout`)), timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function getSafeErrorCode(error: unknown) {
  if (error && typeof error === "object" && "errorCode" in error) {
    const code = (error as { errorCode?: unknown }).errorCode;

    return typeof code === "number" || typeof code === "string" ? String(code).slice(0, 32) : "unknown";
  }

  return error instanceof Error && /_timeout$/.test(error.message) ? error.message : "unknown";
}

function reportSafeSdkError(stage: "init" | "join" | "i18n" | "load", error: unknown) {
  console.error("[zoom-client] SDK failure", { stage, code: getSafeErrorCode(error) });
}

async function fetchJoinData(consultationId: string): Promise<ZoomJoinData> {
  const response = await fetch(`/api/consultations/${encodeURIComponent(consultationId)}/zoom-join`, {
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("join_data_unavailable");
  }

  return (await response.json()) as ZoomJoinData;
}

function callbackToPromise(invoke: (success: () => void, error: (reason: unknown) => void) => void) {
  return new Promise<void>((resolve, reject) => {
    try {
      invoke(resolve, reject);
    } catch (error) {
      reject(error);
    }
  });
}

function ZoomClientApp() {
  const [state, setState] = useState<JoinState>("idle");
  const [message, setMessage] = useState("Press Join Zoom to request camera and microphone access.");
  const consultationId = getConsultationId();

  async function joinMeeting() {
    if (!consultationId || state === "joining") {
      return;
    }

  setState("joining");
  setMessage("Preparing Zoom...");
  let stage: "init" | "join" | "i18n" | "load" = "load";

  try {
      const data = await fetchJoinData(consultationId);

      if (!data.available) {
        setState("error");
        setMessage("This Zoom room is not available for this account.");
        return;
      }

      const { ZoomMtg } = await import("@zoom/meetingsdk");

      ZoomMtg.setZoomJSLib(`https://source.zoom.us/${SDK_VERSION}/lib`, "/av");
      ZoomMtg.preLoadWasm();
      ZoomMtg.prepareWebSDK();
      stage = "i18n";
      await withTimeout(Promise.resolve(ZoomMtg.i18n.load("en-US")), INIT_TIMEOUT_MS, "i18n");
      stage = "init";
      await withTimeout(
        callbackToPromise((success, error) => {
          ZoomMtg.init({
            leaveUrl: data.leaveUrl,
            patchJsMedia: false,
            success,
            error
          });
        }),
        INIT_TIMEOUT_MS,
        "init"
      );
      stage = "join";
      await withTimeout(
        callbackToPromise((success, error) => {
          ZoomMtg.join({
            meetingNumber: data.meetingNumber,
            passWord: data.password,
            signature: data.signature,
            userEmail: "",
            userName: data.userName,
            ...(data.zak ? { zak: data.zak } : {}),
            success,
            error
          });
        }),
        JOIN_TIMEOUT_MS,
        "join"
      );
      setMessage("Connected to Zoom.");
    } catch (error) {
      reportSafeSdkError(stage, error);
      setState("error");
      setMessage("Zoom could not be started. Return to the consultation room and try again.");
    }
  }

  return createElement(
    "main",
    { className: "zoom-launcher" },
    createElement("h1", null, "Zoom Consultation"),
    createElement("p", { role: "status" }, consultationId ? message : "Invalid consultation room."),
    createElement(
      "button",
      {
        disabled: !consultationId || state === "joining",
        onClick: joinMeeting,
        type: "button"
      },
      state === "joining" ? "Connecting…" : state === "error" ? "Try Zoom again" : "Join Zoom"
    )
  );
}

const container = document.getElementById("app");

if (!container) {
  throw new Error("zoom_client_root_missing");
}

createRoot(container).render(createElement(ZoomClientApp));
