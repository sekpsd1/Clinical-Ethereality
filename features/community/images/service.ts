import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getAppEnv } from "@/lib/env/schema";
import { communityImagePolicy } from "@/features/community/images/policy";

export const communityImageEntityType = "community_article_image";

export class CommunityImageError extends Error {
  constructor(
    public readonly code:
      | "FILE_CONTENT_INVALID"
      | "FILE_TOO_LARGE"
      | "FILE_TYPE_NOT_ALLOWED"
      | "STORAGE_NOT_CONFIGURED"
      | "STORAGE_WRITE_FAILED"
  ) {
    super(code);
  }
}

export type PreparedCommunityImage = {
  attachmentId: string;
  storageKey: string;
  storageUrl: string;
  fileName: string;
  mimeType: "image/webp";
  byteSize: number;
  width: number;
  height: number;
  cleanup: () => Promise<void>;
};

function getUploadRoot(): string {
  const configuredRoot = getAppEnv().COMMUNITY_UPLOAD_DIR?.trim();

  if (configuredRoot) {
    const resolvedRoot = path.resolve(configuredRoot);
    const applicationRoot = path.resolve(process.cwd());
    const isInsideApplication =
      resolvedRoot === applicationRoot || resolvedRoot.startsWith(`${applicationRoot}${path.sep}`);

    if (!path.isAbsolute(configuredRoot) || (process.env.NODE_ENV === "production" && isInsideApplication)) {
      throw new CommunityImageError("STORAGE_NOT_CONFIGURED");
    }

    return resolvedRoot;
  }

  if (process.env.NODE_ENV === "production") {
    throw new CommunityImageError("STORAGE_NOT_CONFIGURED");
  }

  return path.resolve(process.cwd(), ".local-uploads");
}

function ownerDirectory(ownerId: string): string {
  return createHash("sha256").update(ownerId).digest("hex").slice(0, 24);
}

function toStorageKey(ownerId: string, articleId: string, attachmentId: string): string {
  return path.posix.join(
    "community",
    ownerDirectory(ownerId),
    createHash("sha256").update(articleId).digest("hex").slice(0, 24),
    `${attachmentId}.webp`
  );
}

export function resolveCommunityImagePath(storageKey: string): string {
  const root = getUploadRoot();
  const resolved = path.resolve(root, ...storageKey.split("/"));

  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new CommunityImageError("STORAGE_WRITE_FAILED");
  }

  return resolved;
}

export async function readCommunityImage(storageKey: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(resolveCommunityImagePath(storageKey)));
}

export async function deleteCommunityImage(storageKey: string | null | undefined): Promise<void> {
  if (!storageKey) {
    return;
  }

  await unlink(resolveCommunityImagePath(storageKey)).catch(() => undefined);
}

async function processImage(file: File): Promise<{
  bytes: Buffer;
  width: number;
  height: number;
}> {
  if (!communityImagePolicy.acceptedMimeTypes.includes(file.type as (typeof communityImagePolicy.acceptedMimeTypes)[number])) {
    throw new CommunityImageError("FILE_TYPE_NOT_ALLOWED");
  }

  if (file.size === 0 || file.size > communityImagePolicy.maxOriginalBytes) {
    throw new CommunityImageError("FILE_TOO_LARGE");
  }

  const input = Buffer.from(await file.arrayBuffer());

  try {
    const metadata = await sharp(input, {
      failOn: "warning",
      limitInputPixels: 40_000_000
    }).metadata();

    if (
      !metadata.width ||
      !metadata.height ||
      !metadata.format ||
      !["jpeg", "png", "webp"].includes(metadata.format) ||
      (metadata.pages ?? 1) !== 1
    ) {
      throw new CommunityImageError("FILE_CONTENT_INVALID");
    }

    const attempts = [
      { dimension: communityImagePolicy.maxDimension, quality: 78 },
      { dimension: 1440, quality: 70 },
      { dimension: 1280, quality: 62 }
    ];

    for (const attempt of attempts) {
      const result = await sharp(input, {
        failOn: "warning",
        limitInputPixels: 40_000_000
      })
        .autoOrient()
        .resize(attempt.dimension, attempt.dimension, {
          fit: "inside",
          withoutEnlargement: true
        })
        .webp({
          quality: attempt.quality,
          effort: 4
        })
        .toBuffer({ resolveWithObject: true });

      if (
        result.data.byteLength <= communityImagePolicy.maxStoredBytes &&
        result.info.width &&
        result.info.height
      ) {
        return {
          bytes: result.data,
          width: result.info.width,
          height: result.info.height
        };
      }
    }
  } catch (error) {
    if (error instanceof CommunityImageError) {
      throw error;
    }

    throw new CommunityImageError("FILE_CONTENT_INVALID");
  }

  throw new CommunityImageError("FILE_TOO_LARGE");
}

export async function prepareCommunityImage(input: {
  file: File;
  ownerId: string;
  articleId: string;
}): Promise<PreparedCommunityImage> {
  const processed = await processImage(input.file);
  const attachmentId = randomUUID();
  const storageKey = toStorageKey(input.ownerId, input.articleId, attachmentId);
  const filePath = resolveCommunityImagePath(storageKey);

  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, processed.bytes, { flag: "wx" });
  } catch {
    throw new CommunityImageError("STORAGE_WRITE_FAILED");
  }

  return {
    attachmentId,
    storageKey,
    storageUrl: `/api/community/images/${attachmentId}`,
    fileName: "community-image.webp",
    mimeType: "image/webp",
    byteSize: processed.bytes.byteLength,
    width: processed.width,
    height: processed.height,
    cleanup: () => deleteCommunityImage(storageKey)
  };
}

export function getCommunityImageErrorMessage(error: unknown): string {
  if (!(error instanceof CommunityImageError)) {
    return "ยังบันทึกรูปไม่ได้ กรุณาลองใหม่";
  }

  const messages: Record<CommunityImageError["code"], string> = {
    FILE_CONTENT_INVALID: "ไฟล์นี้ไม่ใช่รูป JPG, PNG หรือ WebP ที่ถูกต้อง",
    FILE_TOO_LARGE: "รูปมีขนาดใหญ่เกินกำหนด กรุณาใช้รูปต้นฉบับไม่เกิน 5 MB",
    FILE_TYPE_NOT_ALLOWED: "รองรับเฉพาะรูป JPG, PNG หรือ WebP",
    STORAGE_NOT_CONFIGURED: "ยังไม่ได้ตั้งค่า COMMUNITY_UPLOAD_DIR สำหรับพื้นที่เก็บรูปบนโฮส",
    STORAGE_WRITE_FAILED: "ยังเขียนรูปลงพื้นที่เก็บข้อมูลไม่ได้ กรุณาตรวจสิทธิ์โฟลเดอร์"
  };

  return messages[error.code];
}
