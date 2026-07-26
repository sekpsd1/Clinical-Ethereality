import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { getAppEnv } from "@/lib/env/schema";
import { writeAuditLog } from "@/lib/audit/audit-log";
import {
  staffFileEntityTypes,
  staffFileLabels,
  staffFileLimits,
  type StaffFileKind
} from "@/features/staff-files/types";

const mimeExtensions: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

export class StaffFileError extends Error {
  constructor(
    public readonly code:
      | "FILE_EMPTY"
      | "FILE_CONTENT_INVALID"
      | "FILE_TOO_LARGE"
      | "FILE_TYPE_NOT_ALLOWED"
      | "STORAGE_NOT_CONFIGURED"
      | "STORAGE_WRITE_FAILED"
  ) {
    super(code);
  }
}

export type StaffFileUpload = {
  kind: StaffFileKind;
  file: File;
};

function getUploadRoot(): string {
  const configuredRoot = getAppEnv().STAFF_UPLOAD_DIR?.trim();

  if (configuredRoot) {
    const resolvedRoot = path.resolve(configuredRoot);
    const applicationRoot = path.resolve(process.cwd());
    const isInsideApplication =
      resolvedRoot === applicationRoot || resolvedRoot.startsWith(`${applicationRoot}${path.sep}`);

    if (!path.isAbsolute(configuredRoot) || (process.env.NODE_ENV === "production" && isInsideApplication)) {
      throw new StaffFileError("STORAGE_NOT_CONFIGURED");
    }

    return resolvedRoot;
  }

  if (process.env.NODE_ENV === "production") {
    throw new StaffFileError("STORAGE_NOT_CONFIGURED");
  }

  return path.resolve(process.cwd(), ".local-uploads");
}

export function validateStaffFileUpload(upload: StaffFileUpload): string {
  if (!upload.file || upload.file.size === 0) {
    throw new StaffFileError("FILE_EMPTY");
  }

  if (upload.file.size > staffFileLimits[upload.kind]) {
    throw new StaffFileError("FILE_TOO_LARGE");
  }

  const extension = mimeExtensions[upload.file.type];

  if (!extension || (upload.kind === "profilePhoto" && upload.file.type === "application/pdf")) {
    throw new StaffFileError("FILE_TYPE_NOT_ALLOWED");
  }

  return extension;
}

export function validateStaffFileContent(mimeType: string, bytes: Uint8Array): void {
  const matches = (() => {
    if (mimeType === "application/pdf") {
      return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
    }

    if (mimeType === "image/jpeg") {
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }

    if (mimeType === "image/png") {
      const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      return signature.every((byte, index) => bytes[index] === byte);
    }

    if (mimeType === "image/webp") {
      return (
        bytes.length >= 12 &&
        String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
        String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
      );
    }

    return false;
  })();

  if (!matches) {
    throw new StaffFileError("FILE_CONTENT_INVALID");
  }
}

function ownerDirectory(ownerId: string): string {
  return createHash("sha256").update(ownerId).digest("hex").slice(0, 24);
}

function toStorageKey(ownerId: string, kind: StaffFileKind, attachmentId: string, extension: string): string {
  return path.posix.join("staff", ownerDirectory(ownerId), kind, `${attachmentId}${extension}`);
}

export function resolveStaffStoragePath(storageKey: string): string {
  const root = getUploadRoot();
  const resolved = path.resolve(root, ...storageKey.split("/"));
  const rootPrefix = `${root}${path.sep}`;

  if (!resolved.startsWith(rootPrefix)) {
    throw new StaffFileError("STORAGE_WRITE_FAILED");
  }

  return resolved;
}

export async function readStaffFile(storageKey: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(resolveStaffStoragePath(storageKey)));
}

export async function storeStaffFiles(input: {
  actorId: string;
  ownerId: string;
  uploads: StaffFileUpload[];
}): Promise<Array<{ id: string; kind: StaffFileKind; storageUrl: string }>> {
  if (input.uploads.length === 0) {
    return [];
  }

  const prepared = input.uploads.map((upload) => {
    const attachmentId = randomUUID();
    const extension = validateStaffFileUpload(upload);
    const storageKey = toStorageKey(input.ownerId, upload.kind, attachmentId, extension);

    return {
      attachmentId,
      upload,
      storageKey,
      storageUrl: `/api/staff-files/${attachmentId}`
    };
  });
  const writtenPaths: string[] = [];

  try {
    for (const item of prepared) {
      const filePath = resolveStaffStoragePath(item.storageKey);
      const bytes = new Uint8Array(await item.upload.file.arrayBuffer());
      validateStaffFileContent(item.upload.file.type, bytes);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, bytes, { flag: "wx" });
      writtenPaths.push(filePath);
    }

    await prisma.$transaction(async (tx) => {
      for (const item of prepared) {
        const entityType = staffFileEntityTypes[item.upload.kind];

        await tx.fileAttachment.updateMany({
          where: {
            ownerId: input.ownerId,
            entityType,
            entityId: input.ownerId,
            status: "attached"
          },
          data: {
            status: "archived"
          }
        });

        await tx.fileAttachment.create({
          data: {
            id: item.attachmentId,
            ownerId: input.ownerId,
            purpose: "other",
            status: "attached",
            entityType,
            entityId: input.ownerId,
            storageUrl: item.storageUrl,
            storageKey: item.storageKey,
            fileName: item.upload.file.name.slice(0, 255) || staffFileLabels[item.upload.kind],
            mimeType: item.upload.file.type,
            byteSize: item.upload.file.size,
            metadataJson: {
              fileKind: item.upload.kind,
              storageProvider: "local_host",
              visibility: item.upload.kind === "profilePhoto" ? "profile" : "admin_only"
            }
          }
        });

        if (item.upload.kind === "profilePhoto") {
          await tx.user.update({
            where: {
              id: input.ownerId
            },
            data: {
              avatarUrl: item.storageUrl
            }
          });
        }

        await writeAuditLog(tx, {
          actorId: input.actorId,
          action: "staff_file.upload",
          entityType: "file_attachment",
          entityId: item.attachmentId,
          metadata: {
            fileKind: item.upload.kind,
            ownerId: input.ownerId,
            mimeType: item.upload.file.type,
            byteSize: item.upload.file.size
          }
        });
      }
    });
  } catch (error) {
    await Promise.all(writtenPaths.map((filePath) => unlink(filePath).catch(() => undefined)));

    if (error instanceof StaffFileError) {
      throw error;
    }

    throw new StaffFileError("STORAGE_WRITE_FAILED");
  }

  return prepared.map((item) => ({
    id: item.attachmentId,
    kind: item.upload.kind,
    storageUrl: item.storageUrl
  }));
}

export function getStaffFileErrorMessage(error: unknown): string {
  if (!(error instanceof StaffFileError)) {
    return "ไม่สามารถบันทึกไฟล์ได้ กรุณาลองใหม่";
  }

  const messages: Record<StaffFileError["code"], string> = {
    FILE_EMPTY: "กรุณาเลือกไฟล์ที่ต้องการอัปโหลด",
    FILE_CONTENT_INVALID: "เนื้อหาไฟล์ไม่ตรงกับชนิดไฟล์ กรุณาเลือกไฟล์ JPG, PNG, WEBP หรือ PDF ที่ถูกต้อง",
    FILE_TOO_LARGE: "ไฟล์มีขนาดใหญ่เกินกำหนด รูปไม่เกิน 5 MB และใบอนุญาตไม่เกิน 10 MB",
    FILE_TYPE_NOT_ALLOWED: "รองรับรูป JPG, PNG, WEBP และใบอนุญาตแบบ PDF เท่านั้น",
    STORAGE_NOT_CONFIGURED: "ยังไม่ได้ตั้งค่า STAFF_UPLOAD_DIR สำหรับพื้นที่เก็บไฟล์บนโฮส",
    STORAGE_WRITE_FAILED: "ไม่สามารถเขียนไฟล์ลงพื้นที่เก็บข้อมูลได้ กรุณาตรวจสิทธิ์โฟลเดอร์แล้วลองใหม่"
  };

  return messages[error.code];
}
