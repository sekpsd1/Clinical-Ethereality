import { createElement, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createZoomClientInitOptions, revealZoomClientRoot } from "./sdk-runtime";
import {
  checkZoomCameraAndMicrophone,
  getZoomMediaPreflightMessage
} from "./device-preflight";
import {
  buildAndroidChromeIntentUrl,
  createZoomCompletionCleanupGate,
  establishZoomExternalSession,
  getSanitizedHandoffPath,
  isLineInAppBrowser,
  leaveZoomExternalSession,
  ZoomExternalLeaveError
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
type SessionState = "checking" | "external_required" | "ready" | "left" | "error";
type MediaState = "idle" | "checking" | "ready" | "error";
type LeaveState = "idle" | "leaving" | "unavailable" | "error";

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
  const [leaveState, setLeaveState] = useState<LeaveState>("idle");
  const [returnToLineUrl, setReturnToLineUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("กำลังตรวจสิทธิ์ชั่วคราวสำหรับนัดหมาย...");
  const completionCleanupGate = useRef(createZoomCompletionCleanupGate());
  const joinAttemptInFlight = useRef(false);
  const deviceCheckInFlight = useRef(false);
  const consultationId = getConsultationId();
  const isComplete = new URLSearchParams(window.location.search).get("complete") === "1";
  const chromeIntentUrl = buildAndroidChromeIntentUrl(window.location.href);

  useEffect(() => {
    if (isComplete) {
      if (!completionCleanupGate.current.tryStart(true)) {
        return;
      }

      let active = true;

      setMessage("กำลังปิดสิทธิ์ห้องวิดีโอในเบราว์เซอร์นี้...");
      leaveZoomExternalSession()
        .then((result) => {
          if (!active) {
            return;
          }

          completionCleanupGate.current.markLeft();
          setSessionState("left");
          setReturnToLineUrl(result.returnToLineUrl);
          setMessage("ออกจากห้องวิดีโอในเบราว์เซอร์นี้แล้ว คุณสามารถกลับไปยัง LINE Mini App ได้");
        })
        .catch((error: unknown) => {
          if (!active) {
            return;
          }

          const unavailable = error instanceof ZoomExternalLeaveError && error.code === "unavailable";
          if (unavailable) {
            completionCleanupGate.current.markLeft();
          }
          setSessionState("error");
          setLeaveState(unavailable ? "unavailable" : "error");
          setMessage(
            unavailable
              ? "ไม่พบสิทธิ์ห้องวิดีโอที่ยังใช้งานในเบราว์เซอร์นี้ คุณสามารถปิดหน้านี้หรือกลับไปยัง LINE Mini App ได้"
              : "ยังปิดสิทธิ์ห้องวิดีโอไม่ได้ กรุณาลองอีกครั้ง"
          );
        });

      return () => {
        active = false;
      };
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
        setMessage("ตรวจสิทธิ์แล้ว กดปุ่มครั้งเดียวเพื่ออนุญาตกล้องและไมโครโฟน แล้วเข้าห้อง Zoom");
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
    if (sessionState !== "ready" || deviceCheckInFlight.current || joinAttemptInFlight.current) {
      return;
    }

    deviceCheckInFlight.current = true;
    setMediaState("checking");
    setMessage("กำลังขอสิทธิ์และตรวจกล้องกับไมโครโฟน...");

    try {
      await checkZoomCameraAndMicrophone(window.navigator.mediaDevices, window.isSecureContext);
      setMediaState("ready");
      setMessage("กล้องและไมโครโฟนพร้อมแล้ว กดปุ่มหลักเพื่อเข้าห้อง Zoom");
    } catch (error) {
      setMediaState("error");
      setMessage(getZoomMediaPreflightMessage(error));
    } finally {
      deviceCheckInFlight.current = false;
    }
  }

  async function connectToMeeting(targetConsultationId: string): Promise<boolean> {
    setState("joining");
    setMessage("กำลังเตรียมห้อง Zoom...");
    let stage: "init" | "join" | "i18n" | "load" = "load";

    try {
      const data = await fetchJoinData(targetConsultationId);

      if (!data.available) {
        setState("error");
        setMessage("ห้อง Zoom นี้ไม่พร้อมสำหรับบัญชีและนัดหมายนี้");
        return false;
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
      return true;
    } catch (error) {
      reportSafeSdkError(stage, error);
      setState("error");
      setMessage("เปิด Zoom ไม่สำเร็จ กรุณากดลองอีกครั้ง หากยังไม่ได้ให้กลับไปเปิดห้องจาก LINE ใหม่");
      return false;
    }
  }

  async function checkDevicesAndJoin() {
    if (
      !consultationId ||
      sessionState !== "ready" ||
      joinAttemptInFlight.current ||
      deviceCheckInFlight.current
    ) {
      return;
    }

    joinAttemptInFlight.current = true;
    setState("idle");
    setMediaState("checking");
    setMessage("กำลังขอสิทธิ์และตรวจกล้องกับไมโครโฟน...");

    try {
      await checkZoomCameraAndMicrophone(window.navigator.mediaDevices, window.isSecureContext);
      setMediaState("ready");
    } catch (error) {
      setMediaState("error");
      setMessage(getZoomMediaPreflightMessage(error));
      joinAttemptInFlight.current = false;
      return;
    }

    const joined = await connectToMeeting(consultationId);
    joinAttemptInFlight.current = joined;
  }

  async function leaveVideoRoom() {
    if (leaveState === "leaving") {
      return;
    }

    setLeaveState("leaving");
    setMessage("กำลังออกจากห้องวิดีโอในเบราว์เซอร์นี้...");

    try {
      const result = await leaveZoomExternalSession();
      completionCleanupGate.current.markLeft();
      setSessionState("left");
      setReturnToLineUrl(result.returnToLineUrl);
      setLeaveState("idle");
      setMessage("ออกจากห้องวิดีโอในเบราว์เซอร์นี้แล้ว คุณสามารถกลับไปยัง LINE Mini App ได้");
    } catch (error) {
      const unavailable = error instanceof ZoomExternalLeaveError && error.code === "unavailable";
      if (unavailable) {
        completionCleanupGate.current.markLeft();
      }
      setSessionState("error");
      setLeaveState(unavailable ? "unavailable" : "error");
      setMessage(
        unavailable
          ? "ไม่พบสิทธิ์ห้องวิดีโอที่ยังใช้งานในเบราว์เซอร์นี้ คุณสามารถปิดหน้านี้หรือกลับไปยัง LINE Mini App ได้"
          : "ยังออกจากห้องวิดีโอไม่ได้ กรุณาลองอีกครั้ง"
      );
    }
  }

  return createElement(
    "main",
    { className: "zoom-launcher" },
    createElement("h1", null, "วิดีโอคอลปรึกษาแพทย์"),
    createElement("p", { role: "status" }, consultationId || isComplete ? message : "ไม่พบข้อมูลนัดหมายที่ถูกต้อง"),
    isComplete || sessionState === "left"
      ? returnToLineUrl
        ? createElement(
            "a",
            {
              className: "zoom-button",
              href: returnToLineUrl
            },
            "กลับไปหน้าโปรไฟล์ใน LINE"
          )
        : leaveState === "error"
        ? createElement(
            "button",
            {
              onClick: leaveVideoRoom,
              type: "button"
            },
            "ลองออกจากห้องอีกครั้ง"
          )
        : null
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
              disabled:
                !consultationId ||
                sessionState !== "ready" ||
                mediaState === "checking" ||
                state === "joining",
              onClick: checkDevicesAndJoin,
              type: "button"
            },
            mediaState === "checking"
              ? "กำลังตรวจกล้องและไมโครโฟน..."
              : state === "joining"
                ? "กำลังเชื่อมต่อ..."
                : state === "error" || mediaState === "error"
                  ? "ลองตรวจและเข้าห้อง Zoom อีกครั้ง"
                  : "ตรวจอุปกรณ์และเข้าห้อง Zoom"
          ),
          mediaState === "error" || state === "error"
            ? createElement(
                "button",
                {
                  className: "zoom-button-secondary",
                  disabled: sessionState !== "ready" || mediaState === "checking" || state === "joining",
                  onClick: checkDevices,
                  type: "button"
                },
                mediaState === "checking" ? "กำลังทดสอบอุปกรณ์..." : "ทดสอบกล้องและไมโครโฟน"
              )
            : null,
          createElement(
            "button",
            {
              className: "zoom-button-secondary",
              disabled: sessionState !== "ready" || leaveState === "leaving" || state === "joining",
              onClick: leaveVideoRoom,
              type: "button"
            },
            leaveState === "leaving" ? "กำลังออกจากห้อง..." : "ออกจากห้องวิดีโอในเบราว์เซอร์นี้"
          )
        )
  );
}

const container = document.getElementById("app");

if (!container) {
  throw new Error("zoom_client_root_missing");
}

createRoot(container).render(createElement(ZoomClientApp));
