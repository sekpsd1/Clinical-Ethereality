"use client";

import { useState } from "react";
import { Video } from "lucide-react";
import type { ZoomMeetingJoinData } from "@/features/consultations/zoom/types";

export function ZoomMeetingClient({
  data
}: {
  data: Extract<ZoomMeetingJoinData, { available: true }>;
}) {
  const [status, setStatus] = useState<"idle" | "joining" | "error">("idle");
  const [message, setMessage] = useState("กดปุ่มเพื่อเปิด Zoom ระบบจะขอสิทธิ์กล้องและไมโครโฟนจากคุณ");

  async function joinMeeting() {
    setStatus("joining");
    setMessage("กำลังเตรียมห้อง Zoom...");

    try {
      const { ZoomMtg } = await import("@zoom/meetingsdk");

      ZoomMtg.preLoadWasm();
      ZoomMtg.prepareWebSDK();
      ZoomMtg.init({
        leaveUrl: data.leaveUrl,
        patchJsMedia: true,
        success: () => {
          ZoomMtg.join({
            signature: data.signature,
            meetingNumber: data.meetingNumber,
            userName: data.userName,
            userEmail: "",
            passWord: data.password,
            success: () => {
              setMessage("เชื่อมต่อ Zoom แล้ว");
            },
            error: () => {
              setStatus("error");
              setMessage("เข้าห้อง Zoom ไม่สำเร็จ กรุณาตรวจการตั้งค่าหรือเปิดใหม่อีกครั้ง");
            }
          });
        },
        error: () => {
          setStatus("error");
          setMessage("เตรียม Zoom Meeting SDK ไม่สำเร็จ");
        }
      });
    } catch {
      setStatus("error");
      setMessage("โหลด Zoom Meeting SDK ไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  return (
    <div className="rounded-[8px] border border-primary/15 bg-white/80 p-5 text-center shadow-payment-card">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Video aria-hidden="true" className="size-7" strokeWidth={2.1} />
      </span>
      <h1 className="mt-3 font-headline text-xl font-bold text-text">Zoom Consultation</h1>
      <p className="mt-2 text-xs leading-5 text-muted">{message}</p>
      <button
        type="button"
        onClick={joinMeeting}
        disabled={status === "joining"}
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white disabled:opacity-60"
      >
        {status === "joining" ? "กำลังเชื่อมต่อ..." : status === "error" ? "ลองเข้าห้องอีกครั้ง" : "เข้าร่วม Zoom"}
      </button>
    </div>
  );
}
