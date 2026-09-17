"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import {
  createRecordingHandoffRequestGate,
  requestRecordingHandoff,
  type RecordingHandoffDescriptor
} from "@/features/consultations/recordings/recording-handoff-client";
import {
  getRecordingReadinessDelayMs,
  RECORDING_READINESS_MAX_AUTO_ATTEMPTS,
  RECORDING_READINESS_MAX_WINDOW_MS,
  requestRecordingReadiness,
  shouldAutoRetryRecordingReadiness
} from "@/features/consultations/recordings/recording-readiness-client";
import type { RecordingReadinessStatus } from "@/features/consultations/recordings/provider";

type ActionState = "idle" | "view" | "download" | "error";
type ReadinessUiState = {
  status: "checking" | RecordingReadinessStatus;
  manualRetry: boolean;
  retryAfterSeconds?: number;
};

export const recordingHandoffUiCopy = {
  checking: "กำลังตรวจความพร้อมของไฟล์...",
  ready: "ไฟล์พร้อมเปิดดูและดาวน์โหลด",
  processing: "Zoom กำลังเตรียมไฟล์ ระบบจะตรวจให้อีกครั้ง",
  retryable: "ยังตรวจสอบไฟล์ไม่ได้ ระบบจะลองใหม่โดยอัตโนมัติ",
  unavailable: "ไฟล์นี้ยังไม่พร้อมใช้งาน กรุณาลองตรวจสอบอีกครั้งภายหลัง",
  manualRetry: "หยุดตรวจอัตโนมัติแล้ว กดตรวจสอบอีกครั้งเมื่อพร้อม",
  preparingView: "กำลังเตรียมไฟล์เพื่อเปิดดู...",
  preparingDownload: "กำลังเตรียมไฟล์เพื่อดาวน์โหลด...",
  error: "ยังเปิดไฟล์ไม่ได้ กรุณาตรวจความพร้อมแล้วลองใหม่อีกครั้ง"
} as const;

export function RecordingHandoffActions({
  consultationId,
  recordingId,
  autoPoll = true
}: {
  consultationId: string;
  recordingId: string;
  autoPoll?: boolean;
}) {
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [readiness, setReadiness] = useState<ReadinessUiState>({
    status: "checking",
    manualRetry: false
  });
  const [readinessCycle, setReadinessCycle] = useState(0);
  const gate = useRef(createRecordingHandoffRequestGate());

  useEffect(() => {
    let disposed = false;
    let timer: number | null = null;
    let controller: AbortController | null = null;
    let inFlight = false;
    let waitingForVisibility = false;
    let attempt = 0;
    const startedAt = Date.now();

    function clearTimer() {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    }

    function setManualRetry(status: RecordingReadinessStatus, retryAfterSeconds?: number) {
      setReadiness({ status, manualRetry: true, retryAfterSeconds });
    }

    function scheduleCheck(status: RecordingReadinessStatus, retryAfterSeconds?: number) {
      if (!autoPoll) {
        setManualRetry(status, retryAfterSeconds);
        return;
      }
      const delayMs = getRecordingReadinessDelayMs(attempt, retryAfterSeconds);
      attempt += 1;
      if (
        attempt >= RECORDING_READINESS_MAX_AUTO_ATTEMPTS ||
        Date.now() - startedAt + delayMs > RECORDING_READINESS_MAX_WINDOW_MS
      ) {
        setManualRetry(status, retryAfterSeconds);
        return;
      }
      if (document.hidden) {
        waitingForVisibility = true;
        return;
      }
      timer = window.setTimeout(runCheck, delayMs);
    }

    async function runCheck() {
      clearTimer();
      if (disposed || inFlight) return;
      if (document.hidden) {
        waitingForVisibility = true;
        return;
      }
      inFlight = true;
      controller = new AbortController();
      try {
        const result = await requestRecordingReadiness(consultationId, recordingId, controller.signal);
        if (disposed) return;
        setReadiness({ ...result, manualRetry: false });
        if (shouldAutoRetryRecordingReadiness(result.status)) {
          scheduleCheck(result.status, result.retryAfterSeconds);
        }
      } catch (error) {
        if (disposed || (error instanceof DOMException && error.name === "AbortError")) return;
        const result = { status: "retryable" as const };
        setReadiness({ ...result, manualRetry: false });
        scheduleCheck(result.status);
      } finally {
        inFlight = false;
        controller = null;
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        if (timer !== null) {
          clearTimer();
          waitingForVisibility = true;
        }
        return;
      }
      if (waitingForVisibility) {
        waitingForVisibility = false;
        timer = window.setTimeout(runCheck, 500);
      }
    }

    setReadiness({ status: "checking", manualRetry: false });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void runCheck();
    return () => {
      disposed = true;
      clearTimer();
      controller?.abort();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [autoPoll, consultationId, readinessCycle, recordingId]);

  async function open(mode: RecordingHandoffDescriptor["mode"]) {
    if (readiness.status !== "ready") return;
    const result = await gate.current.run(async () => {
      setActionState(mode);
      const target = await requestRecordingHandoff(
        { consultationId, recordingId, mode },
        window.location.origin,
        window.navigator.userAgent
      );
      window.location.assign(target);
      return true;
    }).catch(() => {
      setActionState("error");
      setReadiness({ status: "retryable", manualRetry: true });
      return false;
    });

    if (result === true) return;
  }

  const pending = actionState === "view" || actionState === "download";
  const actionsDisabled = readiness.status !== "ready" || pending;
  const readinessMessage = readiness.manualRetry
    ? recordingHandoffUiCopy.manualRetry
    : readiness.status === "checking"
      ? recordingHandoffUiCopy.checking
      : recordingHandoffUiCopy[readiness.status];
  const actionMessage = actionState === "view"
    ? recordingHandoffUiCopy.preparingView
    : actionState === "download"
      ? recordingHandoffUiCopy.preparingDownload
      : actionState === "error"
        ? recordingHandoffUiCopy.error
        : "";
  const message = actionMessage || readinessMessage;
  const isChecking = readiness.status === "checking" ||
    (!readiness.manualRetry && shouldAutoRetryRecordingReadiness(readiness.status));

  return (
    <div aria-busy={isChecking}>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => open("view")}
          disabled={actionsDisabled}
          aria-busy={actionState === "view"}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] bg-primary/10 px-3 text-xs font-bold text-primary disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ExternalLink aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
          {actionState === "view" ? "กำลังเปิด..." : "เปิดดู"}
        </button>
        <button
          type="button"
          onClick={() => open("download")}
          disabled={actionsDisabled}
          aria-busy={actionState === "download"}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] bg-primary px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Download aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
          {actionState === "download" ? "กำลังเตรียม..." : "ดาวน์โหลด"}
        </button>
      </div>
      <div className="mt-1 flex min-h-7 items-start gap-1.5 text-[10px] leading-4 text-muted" role="status" aria-live="polite">
        {isChecking ? <LoaderCircle aria-hidden="true" className="mt-0.5 size-3 shrink-0 animate-spin" /> : null}
        <span>{message}</span>
      </div>
      {readiness.manualRetry || readiness.status === "unavailable" || actionState === "error" ? (
        <button
          type="button"
          onClick={() => {
            setActionState("idle");
            setReadinessCycle((cycle) => cycle + 1);
          }}
          className="mt-1 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[8px] border border-primary/20 bg-white px-3 text-xs font-bold text-primary"
        >
          <RefreshCw aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
          ตรวจสอบความพร้อมอีกครั้ง
        </button>
      ) : null}
    </div>
  );
}
