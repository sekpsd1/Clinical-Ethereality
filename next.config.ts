import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

function getConfiguredStorageImagePattern(): URL | null {
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim();

  if (!publicBaseUrl) {
    return null;
  }

  try {
    const url = new URL(publicBaseUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    const pathname = url.pathname.endsWith("/") ? `${url.pathname}**` : `${url.pathname}/**`;

    return new URL(`${url.origin}${pathname}`);
  } catch {
    return null;
  }
}

const configuredStorageImagePattern = getConfiguredStorageImagePattern();

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb"
    }
  },
  images: {
    remotePatterns: [
      new URL("https://profile.line-scdn.net/**"),
      new URL("https://res.cloudinary.com/**"),
      ...(configuredStorageImagePattern ? [configuredStorageImagePattern] : [])
    ]
  }
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  telemetry: false,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true
    }
  }
});
