import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

function stripDoctorInviteFragment(value: string | undefined): string | undefined {
  if (!value) return value;

  try {
    const url = new URL(value, window.location.origin);
    if (url.pathname === "/doctor-invite" || url.pathname.startsWith("/doctor-invite/")) {
      url.hash = "";
      return url.toString();
    }
  } catch {
    return value;
  }

  return value;
}

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0"),
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = stripDoctorInviteFragment(event.request.url);
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (typeof breadcrumb.data?.url === "string") {
        breadcrumb.data.url = stripDoctorInviteFragment(breadcrumb.data.url);
      }
      return breadcrumb;
    }
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
