"use client";

import { useRef, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import {
  createRecordingHandoffRequestGate,
  RecordingHandoffRequestError,
  requestRecordingHandoff,
  type RecordingHandoffDescriptor
} from "@/features/consultations/recordings/recording-handoff-client";

type ActionState = "idle" | "view" | "download" | "unavailable" | "error";

export const recordingHandoffUiCopy = {
  preparingView: "กำลังเตรียมไฟล์เพื่อเปิดดู...",
  preparingDownload: "กำลังเตรียมไฟล์เพื่อดาวน์โหลด...",
  unavailable: "ไฟล์ยังไม่พร้อมใช้งาน กรุณารอสักครู่แล้วกดตรวจสอบอีกครั้ง",
  error: "ยังเปิดไฟล์ไม่ได้ กรุณาลองกดใหม่อีกครั้ง"
} as const;

export function RecordingHandoffActions({
  consultationId,
  recordingId
}: {
  consultationId: string;
  recordingId: string;
}) {
  const [state, setState] = useState<ActionState>("idle");
  const [retryMode, setRetryMode] = useState<RecordingHandoffDescriptor["mode"]>("view");
  const gate = useRef(createRecordingHandoffRequestGate());

  async function open(mode: RecordingHandoffDescriptor["mode"]) {
    setRetryMode(mode);
    const result = await gate.current.run(async () => {
      setState(mode);
      const target = await requestRecordingHandoff(
        { consultationId, recordingId, mode },
        window.location.origin,
        window.navigator.userAgent
      );
      window.location.assign(target);
      return true;
    }).catch((error: unknown) => {
      setState(error instanceof RecordingHandoffRequestError && !error.retryable ? "error" : "unavailable");
      return false;
    });

    if (result === true) return;
  }

  const pending = state === "view" || state === "download";
  const message = state === "view"
    ? recordingHandoffUiCopy.preparingView
    : state === "download"
      ? recordingHandoffUiCopy.preparingDownload
      : state === "error"
        ? recordingHandoffUiCopy.error
        : state === "unavailable"
          ? recordingHandoffUiCopy.unavailable
        : "";

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => open("view")}
          disabled={pending}
          aria-busy={state === "view"}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[8px] bg-primary/10 px-3 text-xs font-bold text-primary disabled:opacity-60"
        >
          <ExternalLink aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
          {state === "view" ? "กำลังตรวจสอบ..." : "ตรวจสอบเพื่อเปิด"}
        </button>
        <button
          type="button"
          onClick={() => open("download")}
          disabled={pending}
          aria-busy={state === "download"}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[8px] bg-primary px-3 text-xs font-bold text-white disabled:opacity-60"
        >
          <Download aria-hidden="true" className="size-3.5" strokeWidth={2.1} />
          {state === "download" ? "กำลังตรวจสอบ..." : "ตรวจสอบเพื่อดาวน์โหลด"}
        </button>
      </div>
      <p className="mt-1 min-h-4 text-[10px] leading-4 text-muted" role="status" aria-live="polite">
        {message}
      </p>
      {state === "unavailable" ? (
        <button
          type="button"
          onClick={() => open(retryMode)}
          className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-full border border-primary/25 bg-white px-3 text-xs font-bold text-primary"
        >
          ตรวจสอบและลองอีกครั้ง
        </button>
      ) : null}
    </div>
  );
}
