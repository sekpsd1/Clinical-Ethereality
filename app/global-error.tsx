"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="min-h-screen bg-background px-6 py-10 text-text">
          <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-5">
            <p className="text-sm font-medium uppercase tracking-[0.12em] text-muted">
              Clinical Ethereality
            </p>
            <div className="space-y-3">
              <h1 className="text-2xl font-semibold">Something needs attention</h1>
              <p className="text-sm leading-6 text-muted">
                This screen could not load safely. The care team can review the issue without exposing sensitive
                workflow details here.
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="h-11 rounded-badge bg-primary px-5 text-sm font-semibold text-white shadow-glass"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
