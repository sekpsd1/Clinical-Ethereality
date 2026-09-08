import { createElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createZoomClientInitOptions, revealZoomClientRoot } from "./sdk-runtime";
import {
  checkZoomCameraAndMicrophone,
  getZoomMediaPreflightMessage
} from "./device-preflight";
import {
  buildAndroidChromeIntentUrl,
  establishZoomExternalSession,
  getSanitizedHandoffPath,
  isLineInAppBrowser
} from "./handoff";
import "./styles.css";

type ZoomJoinData =
  | {
      available: true;
      meetingNumber: string;
      password: string;
      signature: string;
      zak?: string;
      userName: string;
      customerKey: string;
      leaveUrl: string;
    }
  | {
      available: false;
      message: string;
      leaveUrl: string;
    };

type JoinState = "idle" | "joining" | "error";
type SessionState = "checking" | "external_required" | "ready" | "error";
type MediaState = "idle" | "checking" | "ready" | "error";

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
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [mediaState, setMediaState] = useState<MediaState>("idle");
  const [message, setMessage] = useState("กำลังตรวจสิทธิ์ชั่วคราวสำหรับนัดหมาย...");
  const consultationId = getConsultationId();
  const isComplete = new URLSearchParams(window.location.search).get("complete") === "1";
  const chromeIntentUrl = buildAndroidChromeIntentUrl(window.location.href);

  useEffect(() => {
    if (isComplete) {
      setSessionState("ready");
      setMessage("ออกจากห้อง Zoom แล้ว คุณสามารถกลับไปยัง LINE Mini App ได้");
      return;
    }

    if (!consultationId) {
      setSessionState("error");
      setMessage("ไม่พบข้อมูลนัดหมายที่ถูกต้อง");
      return;
    }

    if (isLineInAppBrowser(window.navigator.userAgent)) {
      setSessionState("external_required");
      setMessage(
        chromeIntentUrl
          ? "กดปุ่มด้านล่างเพื่อเปิดเบราว์เซอร์และเริ่มวิดีโอคอล"
          : "ไม่สามารถสร้างทางลัดไป Chrome ได้ กรุณากลับไปที่ LINE แล้วกดเปิด Zoom อีกครั้ง"
      );
      return;
    }

    let active = true;

    const handoffSource = window.location.hash;
    const sanitizedHandoffPath = getSanitizedHandoffPath(window.location.href);

    if (sanitizedHandoffPath) {
      window.history.replaceState(null, "", sanitizedHandoffPath);
    }

    establishZoomExternalSession(consultationId, handoffSource)
      .then(() => {
        if (!active) {
          return;
        }

        setSessionState("ready");
        setMessage("ตรวจสิทธิ์แล้ว กรุณาตรวจกล้องและไมโครโฟนก่อนเข้าห้อง");
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setSessionState("error");
        setMessage("สิทธิ์เข้าห้องหมดอายุหรือถูกใช้แล้ว กรุณากลับไปเปิด Zoom จาก LINE อีกครั้ง");
      });

    return () => {
      active = false;
    };
  }, [chromeIntentUrl, consultationId, isComplete]);

  async function checkDevices() {
    if (sessionState !== "ready" || mediaState === "checking") {
      return;
    }

    setMediaState("checking");
    setMessage("กำลังขอสิทธิ์และตรวจกล้องกับไมโครโฟน...");

    try {
      await checkZoomCameraAndMicrophone(window.navigator.mediaDevices, window.isSecureContext);
      setMediaState("ready");
      setMessage("กล้องและไมโครโฟนพร้อมแล้ว กดเข้าห้อง Zoom ได้");
    } catch (error) {
      setMediaState("error");
      setMessage(getZoomMediaPreflightMessage(error));
    }
  }

  async function joinMeeting() {
    if (!consultationId || sessionState !== "ready" || mediaState !== "ready" || state === "joining") {
      return;
    }

    setState("joining");
    setMessage("กำลังเตรียมห้อง Zoom...");
    let stage: "init" | "join" | "i18n" | "load" = "load";

    try {
      const data = await fetchJoinData(consultationId);

      if (!data.available) {
        setState("error");
        setMessage("ห้อง Zoom นี้ไม่พร้อมสำหรับบัญชีและนัดหมายนี้");
        return;
      }

      const { ZoomMtg } = await import("@zoom/meetingsdk");

      ZoomMtg.setZoomJSLib(`https://source.zoom.us/${SDK_VERSION}/lib`, "/av");
      ZoomMtg.preLoadWasm();
      ZoomMtg.prepareWebSDK();
      revealZoomClientRoot(document.getElementById("zmmtg-root"));
      stage = "i18n";
      await withTimeout(Promise.resolve(ZoomMtg.i18n.load("en-US")), INIT_TIMEOUT_MS, "i18n");
      stage = "init";
      await withTimeout(
        callbackToPromise((success, error) => {
          ZoomMtg.init(createZoomClientInitOptions(data.leaveUrl, success, error));
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
            customerKey: data.customerKey,
            ...(data.zak ? { zak: data.zak } : {}),
            success,
            error
          });
        }),
        JOIN_TIMEOUT_MS,
        "join"
      );
      setMessage("เชื่อมต่อ Zoom แล้ว");
    } catch (error) {
      reportSafeSdkError(stage, error);
      setState("error");
      setMessage("เปิด Zoom ไม่สำเร็จ กรุณากลับไปที่ LINE แล้วลองเปิดห้องอีกครั้ง");
    }
  }

  return createElement(
    "main",
    { className: "zoom-launcher" },
    createElement("h1", null, "วิดีโอคอลปรึกษาแพทย์"),
    createElement("p", { role: "status" }, consultationId || isComplete ? message : "ไม่พบข้อมูลนัดหมายที่ถูกต้อง"),
    isComplete
      ? null
      : sessionState === "external_required"
        ? chromeIntentUrl
          ? createElement(
              "a",
              {
                className: "zoom-button",
                href: chromeIntentUrl
              },
              "เปิดวิดีโอคอลใน Chrome"
            )
          : null
      : createElement(
          "div",
          { className: "zoom-actions" },
          createElement(
            "button",
            {
              disabled: sessionState !== "ready" || mediaState === "checking" || state === "joining",
              onClick: checkDevices,
              type: "button"
            },
            mediaState === "checking" ? "กำลังตรวจ..." : mediaState === "ready" ? "ตรวจอุปกรณ์อีกครั้ง" : "ตรวจกล้องและไมโครโฟน"
          ),
          createElement(
            "button",
            {
              disabled: !consultationId || sessionState !== "ready" || mediaState !== "ready" || state === "joining",
              onClick: joinMeeting,
              type: "button"
            },
            state === "joining" ? "กำลังเชื่อมต่อ…" : state === "error" ? "ลองเข้าห้องอีกครั้ง" : "เข้าห้อง Zoom"
          )
        )
  );
}

const container = document.getElementById("app");

if (!container) {
  throw new Error("zoom_client_root_missing");
}

createRoot(container).render(createElement(ZoomClientApp));
