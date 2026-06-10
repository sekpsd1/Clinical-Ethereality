import { getAppEnv, type AppEnv } from "@/lib/env/schema";

export type StorageProvider = "cloudinary" | "s3" | "not_configured";

export type StorageReadiness = {
  provider: StorageProvider;
  isConfigured: boolean;
  canAcceptHostedUrl: boolean;
  publicBaseUrl: string | null;
  configuredKeys: string[];
  missingKeys: string[];
};

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function normalizeBaseUrl(value: string | undefined): string | null {
  const candidate = value?.trim();

  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function cloudinaryBaseUrl(env: AppEnv): string | null {
  if (!hasValue(env.CLOUDINARY_CLOUD_NAME)) {
    return null;
  }

  return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}`;
}

export function getStorageReadiness(env: AppEnv = getAppEnv()): StorageReadiness {
  const configuredKeys: string[] = [];
  const missingKeys: string[] = [];

  const hasCloudinary =
    hasValue(env.CLOUDINARY_CLOUD_NAME) && hasValue(env.CLOUDINARY_API_KEY) && hasValue(env.CLOUDINARY_API_SECRET);
  const hasS3Credentials =
    hasValue(env.S3_BUCKET) &&
    hasValue(env.S3_ACCESS_KEY_ID) &&
    hasValue(env.S3_SECRET_ACCESS_KEY) &&
    (hasValue(env.S3_REGION) || hasValue(env.S3_ENDPOINT));
  const s3PublicBaseUrl = normalizeBaseUrl(env.S3_PUBLIC_BASE_URL);
  const hasS3 = hasS3Credentials && Boolean(s3PublicBaseUrl);

  for (const [name, ready] of [
    ["CLOUDINARY_CLOUD_NAME", hasValue(env.CLOUDINARY_CLOUD_NAME)],
    ["CLOUDINARY_API_KEY", hasValue(env.CLOUDINARY_API_KEY)],
    ["CLOUDINARY_API_SECRET", hasValue(env.CLOUDINARY_API_SECRET)],
    ["S3_BUCKET", hasValue(env.S3_BUCKET)],
    ["S3_ACCESS_KEY_ID", hasValue(env.S3_ACCESS_KEY_ID)],
    ["S3_SECRET_ACCESS_KEY", hasValue(env.S3_SECRET_ACCESS_KEY)],
    ["S3_REGION or S3_ENDPOINT", hasValue(env.S3_REGION) || hasValue(env.S3_ENDPOINT)],
    ["S3_PUBLIC_BASE_URL", Boolean(s3PublicBaseUrl)]
  ] as const) {
    if (ready) {
      configuredKeys.push(name);
    }
  }

  if (!hasCloudinary && !hasS3Credentials) {
    missingKeys.push("Cloudinary credentials or S3 credentials");
  }

  if (hasS3Credentials && !s3PublicBaseUrl) {
    missingKeys.push("S3_PUBLIC_BASE_URL");
  }

  if (!hasCloudinary && configuredKeys.some((key) => key.startsWith("CLOUDINARY_"))) {
    for (const [name, ready] of [
      ["CLOUDINARY_CLOUD_NAME", hasValue(env.CLOUDINARY_CLOUD_NAME)],
      ["CLOUDINARY_API_KEY", hasValue(env.CLOUDINARY_API_KEY)],
      ["CLOUDINARY_API_SECRET", hasValue(env.CLOUDINARY_API_SECRET)]
    ] as const) {
      if (!ready) {
        missingKeys.push(name);
      }
    }
  }

  if (!hasS3Credentials && configuredKeys.some((key) => key.startsWith("S3_"))) {
    for (const [name, ready] of [
      ["S3_BUCKET", hasValue(env.S3_BUCKET)],
      ["S3_ACCESS_KEY_ID", hasValue(env.S3_ACCESS_KEY_ID)],
      ["S3_SECRET_ACCESS_KEY", hasValue(env.S3_SECRET_ACCESS_KEY)],
      ["S3_REGION or S3_ENDPOINT", hasValue(env.S3_REGION) || hasValue(env.S3_ENDPOINT)]
    ] as const) {
      if (!ready) {
        missingKeys.push(name);
      }
    }
  }

  if (hasS3) {
    return {
      provider: "s3",
      isConfigured: true,
      canAcceptHostedUrl: true,
      publicBaseUrl: s3PublicBaseUrl,
      configuredKeys,
      missingKeys: []
    };
  }

  if (hasCloudinary) {
    return {
      provider: "cloudinary",
      isConfigured: true,
      canAcceptHostedUrl: true,
      publicBaseUrl: cloudinaryBaseUrl(env),
      configuredKeys,
      missingKeys: []
    };
  }

  return {
    provider: "not_configured",
    isConfigured: false,
    canAcceptHostedUrl: true,
    publicBaseUrl: null,
    configuredKeys,
    missingKeys: Array.from(new Set(missingKeys))
  };
}
