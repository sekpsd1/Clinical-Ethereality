"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import {
  createRecordingHandoffRequestGate,
  requestRecordingHandoff,
  type RecordingHandoffDescriptor
} from "@/features/consultations/recordings/recording-handoff-client";
import {
  createRecordingReadinessRequestGate,
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
  checking: "กำลังตรวจสอบสถานะไฟล์...",
  ready: "ไฟล์พร้อมแล้ว สามารถเปิดดูหรือดาวน์โหลดได้",
  processing: "Zoom ยังประมวลผลไฟล์อยู่",
  retryable: "ยังตรวจสอบความพร้อมของไฟล์ไม่ได้ชั่วคราว",
  unavailable: "ไฟล์ยังไม่พร้อมใช้งานในขณะนี้ กรุณารีเฟรชสถานะอีกครั้งภายหลัง",
  manualRetry: "หยุดการตรวจอัตโนมัติแล้ว กดรีเฟรชสถานะไฟล์เมื่อต้องการตรวจอีกครั้ง",
  refresh: "รีเฟรชสถานะไฟล์",
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
  const [readinessRequestInFlight, setReadinessRequestInFlight] = useState(false);
  const gate = useRef(createRecordingHandoffRequestGate());
  const readinessGate = useRef(createRecordingReadinessRequestGate());
  const readinessRequestInFlightRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    let timer: number | null = null;
    let controller: AbortController | null = null;
    let waitingForVisibility = false;
    let attempt = 0;
    const startedAt = Date.now();
    const pollThisCycle = autoPoll || readinessCycle > 0;

    function clearTimer() {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    }

    function setManualRetry(status: RecordingReadinessStatus, retryAfterSeconds?: number) {
      setReadiness({ status, manualRetry: true, retryAfterSeconds });
    }

    function scheduleCheck(status: RecordingReadinessStatus, retryAfterSeconds?: number) {
      if (!pollThisCycle) {
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
      if (disposed) return;
      if (document.hidden) {
        waitingForVisibility = true;
        return;
      }
      let gatedResult: Awaited<ReturnType<typeof requestRecordingReadiness>> | null;
      try {
        gatedResult = await readinessGate.current.run(async () => {
          readinessRequestInFlightRef.current = true;
          setReadinessRequestInFlight(true);
          controller = new AbortController();
          try {
            return await requestRecordingReadiness(consultationId, recordingId, controller.signal);
          } finally {
            controller = null;
            readinessRequestInFlightRef.current = false;
            if (!disposed) setReadinessRequestInFlight(false);
          }
        });
      } catch (error) {
        if (disposed || (error instanceof DOMException && error.name === "AbortError")) return;
        const result = { status: "retryable" as const };
        setReadiness({ ...result, manualRetry: false });
        scheduleCheck(result.status);
        return;
      }
      if (gatedResult === null) {
        await readinessGate.current.waitForIdle();
        if (!disposed) timer = window.setTimeout(runCheck, 0);
        return;
      }
      if (disposed) return;
      const result = gatedResult;
      setReadiness({ ...result, manualRetry: false });
      if (shouldAutoRetryRecordingReadiness(result.status)) {
        scheduleCheck(result.status, result.retryAfterSeconds);
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
  const refreshBusy = readinessRequestInFlight || pending;
  const readinessMessage = readiness.status === "checking"
    ? recordingHandoffUiCopy.checking
    : recordingHandoffUiCopy[readiness.status];
  const actionMessage = actionState === "view"
    ? recordingHandoffUiCopy.preparingView
    : actionState === "download"
      ? recordingHandoffUiCopy.preparingDownload
      : actionState === "error"
        ? recordingHandoffUiCopy.error
        : "";
  const statusTone = readiness.status === "ready"
    ? "border-primary/20 bg-primary/10"
    : readiness.status === "unavailable"
      ? "border-danger/20 bg-danger/5"
      : "border-warning/25 bg-warning/10";

  function refreshReadiness() {
    if (readinessRequestInFlightRef.current) return;
    setActionState("idle");
    setReadiness({ status: "checking", manualRetry: false });
    setReadinessCycle((cycle) => cycle + 1);
  }

  return (
    <div>
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
      <div
        className={`mt-2 flex min-h-11 items-start gap-2 rounded-[8px] border px-3 py-2 text-xs font-semibold leading-5 text-text ${statusTone}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-busy={readinessRequestInFlight}
        data-readiness-status={readiness.status}
      >
        {readinessRequestInFlight ? (
          <LoaderCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
        ) : (
          <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-current opacity-65" />
        )}
        <span>
          {readinessMessage}
          {readiness.manualRetry ? (
            <span className="mt-0.5 block text-[10px] font-medium leading-4 text-muted">
              {recordingHandoffUiCopy.manualRetry}
            </span>
          ) : null}
        </span>
      </div>
      {actionMessage ? (
        <p className="mt-1 text-[10px] leading-4 text-muted" role={actionState === "error" ? "alert" : "status"}>
          {actionMessage}
        </p>
      ) : null}
      <button
        type="button"
        onClick={refreshReadiness}
        disabled={refreshBusy}
        aria-busy={refreshBusy}
        className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[8px] border border-primary/20 bg-white px-3 text-xs font-bold text-primary disabled:cursor-not-allowed disabled:opacity-45"
      >
        {refreshBusy ? (
          <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" strokeWidth={2.1} />
        ) : (
          <RefreshCw aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
        )}
        {recordingHandoffUiCopy.refresh}
      </button>
    </div>
  );
}
