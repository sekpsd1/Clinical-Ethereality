"use client";

import { useEffect, useState } from "react";
import {
  buildAndroidRecordingChromeIntentUrl,
  exchangeRecordingHandoffSession,
  getProtectedRecordingUrl,
  getRecordingHandoffDescriptor,
  getSanitizedRecordingHandoffPath,
  isAndroidUserAgent,
  isLineInAppBrowser
} from "@/features/consultations/recordings/recording-handoff-client";

type PageState = "checking" | "android" | "error";

export function RecordingExternalHandoffPage() {
  const [state, setState] = useState<PageState>("checking");
  const [androidIntent, setAndroidIntent] = useState<string | null>(null);

  useEffect(() => {
    const descriptor = getRecordingHandoffDescriptor(window.location.href);
    if (!descriptor) {
      setState("error");
      return;
    }

    if (isLineInAppBrowser(window.navigator.userAgent)) {
      if (isAndroidUserAgent(window.navigator.userAgent)) {
        const intent = buildAndroidRecordingChromeIntentUrl(window.location.href);
        setAndroidIntent(intent);
        setState(intent ? "android" : "error");
      } else {
        setState("error");
      }
      return;
    }

    const fragment = window.location.hash;
    const sanitized = getSanitizedRecordingHandoffPath(window.location.href);
    if (sanitized) window.history.replaceState(null, "", sanitized);

    exchangeRecordingHandoffSession(descriptor, fragment)
      .then(() => window.location.replace(getProtectedRecordingUrl(descriptor)))
      .catch(() => setState("error"));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-10">
      <section className="w-full rounded-[8px] border border-primary/15 bg-white p-6 text-center shadow-payment-card">
        <h1 className="font-headline text-xl font-bold text-text">เปิดบันทึกการปรึกษา</h1>
        <p className="mt-3 text-sm leading-6 text-muted" role="status" aria-live="polite">
          {state === "checking"
            ? "กำลังตรวจสิทธิ์ชั่วคราว กรุณารอสักครู่..."
            : state === "android"
              ? "กดปุ่มด้านล่างเพื่อเปิดไฟล์ใน Chrome"
              : "ลิงก์นี้หมดอายุหรือใช้แล้ว กรุณากลับไปที่ LINE แล้วกดเปิดไฟล์ใหม่อีกครั้ง"}
        </p>
        {state === "android" && androidIntent ? (
          <a
            href={androidIntent}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-white"
          >
            เปิดไฟล์ใน Chrome
          </a>
        ) : null}
      </section>
    </main>
  );
}
