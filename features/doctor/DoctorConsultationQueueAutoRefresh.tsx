"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_REFRESH_INTERVAL_MS = 5_000;

export function DoctorConsultationQueueAutoRefresh({
  enabled,
  intervalMs = DEFAULT_REFRESH_INTERVAL_MS
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let intervalId: number | undefined;
    let resumeRefreshId: number | undefined;

    const isVisible = () => document.visibilityState === "visible";

    const stopPolling = () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const cancelResumeRefresh = () => {
      if (resumeRefreshId !== undefined) {
        window.clearTimeout(resumeRefreshId);
        resumeRefreshId = undefined;
      }
    };

    const refreshAfterResume = () => {
      if (!isVisible() || resumeRefreshId !== undefined) {
        return;
      }

      resumeRefreshId = window.setTimeout(() => {
        resumeRefreshId = undefined;

        if (isVisible()) {
          router.refresh();
        }
      }, 0);
    };

    const startPolling = () => {
      if (!isVisible() || intervalId !== undefined) {
        return;
      }

      intervalId = window.setInterval(() => {
        if (!isVisible()) {
          stopPolling();
          return;
        }

        if (resumeRefreshId === undefined) {
          router.refresh();
        }
      }, intervalMs);
    };

    const resume = () => {
      if (!isVisible()) {
        return;
      }

      refreshAfterResume();
      startPolling();
    };

    const handleVisibilityChange = () => {
      if (isVisible()) {
        resume();
        return;
      }

      cancelResumeRefresh();
      stopPolling();
    };

    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    startPolling();

    return () => {
      cancelResumeRefresh();
      stopPolling();
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, intervalMs, router]);

  return null;
}
