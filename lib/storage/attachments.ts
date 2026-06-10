import { getStorageReadiness, type StorageProvider, type StorageReadiness } from "@/lib/storage/provider";
import type { Prisma } from "@prisma/client";

export type HostedAttachmentInput = {
  storageUrl: string;
  fileName?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
};

export type NormalizedHostedAttachment = {
  storageUrl: string;
  storageKey: string | null;
  fileName: string;
  mimeType: string | null;
  byteSize: number | null;
  storageProvider: StorageProvider;
  storageConfigured: boolean;
};

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function isUrlInsideBase(url: URL, baseUrl: string): boolean {
  const base = new URL(ensureTrailingSlash(baseUrl));
  return url.origin === base.origin && url.pathname.startsWith(base.pathname);
}

function extractStorageKey(url: URL, baseUrl: string | null): string | null {
  if (!baseUrl) {
    return url.pathname.replace(/^\/+/, "") || null;
  }

  const base = new URL(ensureTrailingSlash(baseUrl));
  const key = url.pathname.slice(base.pathname.length).replace(/^\/+/, "");
  return key || null;
}

function inferFileName(url: URL): string {
  const candidate = url.pathname.split("/").filter(Boolean).pop();

  if (!candidate) {
    return "attachment";
  }

  try {
    return decodeURIComponent(candidate);
  } catch {
    return candidate;
  }
}

export function normalizeHostedAttachmentInput(
  input: HostedAttachmentInput,
  readiness: StorageReadiness = getStorageReadiness()
): NormalizedHostedAttachment {
  const storageUrl = input.storageUrl.trim();
  const url = new URL(storageUrl);

  if (readiness.publicBaseUrl && !isUrlInsideBase(url, readiness.publicBaseUrl)) {
    throw new Error("Hosted file URL is outside the configured storage base URL.");
  }

  const fileName = trimOrNull(input.fileName) ?? inferFileName(url);
  const mimeType = trimOrNull(input.mimeType);
  const byteSize = input.byteSize && input.byteSize > 0 ? input.byteSize : null;

  return {
    storageUrl: url.toString(),
    storageKey: extractStorageKey(url, readiness.publicBaseUrl),
    fileName,
    mimeType,
    byteSize,
    storageProvider: readiness.provider,
    storageConfigured: readiness.isConfigured
  };
}

export function buildAttachmentMetadata(
  attachment: NormalizedHostedAttachment,
  extra: Prisma.InputJsonObject = {}
): Prisma.InputJsonObject {
  return {
    ...extra,
    storageProvider: attachment.storageProvider,
    storageConfigured: attachment.storageConfigured
  };
}
