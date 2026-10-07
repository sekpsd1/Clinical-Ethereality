import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getAppEnv } from "@/lib/env/schema";

export class DriveArchiveError extends Error {
  constructor(public readonly code: "NOT_CONFIGURED" | "PROVIDER_UNAVAILABLE" | "INVALID_METADATA") {
    super(code);
  }
}

export function getDriveArchiveConfig(allowDisabled = false) {
  const env = getAppEnv();
  if ((!allowDisabled && !env.ENABLE_GOOGLE_DRIVE_RECORDING_ARCHIVE) || !env.GOOGLE_DRIVE_CLIENT_ID ||
      !env.GOOGLE_DRIVE_CLIENT_SECRET || !env.GOOGLE_DRIVE_REFRESH_TOKEN ||
      !env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID || !env.GOOGLE_DRIVE_ARCHIVE_SESSION_KEY ||
      !env.GOOGLE_DRIVE_ARCHIVE_JOB_SECRET) throw new DriveArchiveError("NOT_CONFIGURED");
  return {
    clientId: env.GOOGLE_DRIVE_CLIENT_ID, clientSecret: env.GOOGLE_DRIVE_CLIENT_SECRET,
    refreshToken: env.GOOGLE_DRIVE_REFRESH_TOKEN, folderId: env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID,
    sessionKey: env.GOOGLE_DRIVE_ARCHIVE_SESSION_KEY
  };
}

export async function getDriveAccessToken(allowDisabled = false): Promise<string> {
  const config = getDriveArchiveConfig(allowDisabled);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", body: new URLSearchParams({ grant_type: "refresh_token", client_id: config.clientId,
      client_secret: config.clientSecret, refresh_token: config.refreshToken }),
    cache: "no-store", signal: AbortSignal.timeout(15_000), redirect: "error"
  });
  if (!response.ok) throw new DriveArchiveError("PROVIDER_UNAVAILABLE");
  const data = await response.json();
  if (typeof data.access_token !== "string" || !data.access_token) throw new DriveArchiveError("PROVIDER_UNAVAILABLE");
  // A previously granted broader scope must not silently be used by this integration.
  if (typeof data.scope === "string" && data.scope.split(" ").some((scope: string) =>
    scope !== "https://www.googleapis.com/auth/drive.file")) throw new DriveArchiveError("INVALID_METADATA");
  return data.access_token;
}

export function validateUploadSession(url: string): string {
  const parsed = new URL(url);
  if (parsed.origin !== "https://www.googleapis.com" || parsed.pathname !== "/upload/drive/v3/files" ||
      parsed.username || parsed.password || parsed.hash || parsed.searchParams.get("uploadType") !== "resumable" ||
      !parsed.searchParams.get("upload_id")) throw new DriveArchiveError("INVALID_METADATA");
  return parsed.href;
}

export function encryptUploadSession(url: string, recordingId: string, key: string): string {
  validateUploadSession(url);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  cipher.setAAD(Buffer.from(`drive-archive:${recordingId}`));
  const encrypted = Buffer.concat([cipher.update(url, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

export function decryptUploadSession(value: string, recordingId: string, key: string): string {
  try {
    const bytes = Buffer.from(value, "base64");
    const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(`drive-archive:${recordingId}`));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return validateUploadSession(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
  } catch { throw new DriveArchiveError("INVALID_METADATA"); }
}

export function driveFetch(token: string, path: string, init: RequestInit = {}) {
  return fetch(`https://www.googleapis.com/drive/v3/${path}`, { ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
    cache: "no-store", signal: AbortSignal.timeout(25_000), redirect: "error" });
}

export async function assertPrivateArchiveFolder(token: string) {
  const { folderId } = getDriveArchiveConfig();
  const response = await driveFetch(token, `files/${encodeURIComponent(folderId)}?fields=id,mimeType,trashed,driveId,permissions(type,role)`);
  if (!response.ok) throw new DriveArchiveError("PROVIDER_UNAVAILABLE");
  const folder = await response.json();
  if (folder.id !== folderId || folder.mimeType !== "application/vnd.google-apps.folder" || folder.trashed !== false ||
      folder.driveId || !Array.isArray(folder.permissions) || folder.permissions.length === 0 ||
      folder.permissions.some((permission: {type?: string; role?: string}) => permission.type !== "user" || permission.role !== "owner")) {
    throw new DriveArchiveError("INVALID_METADATA");
  }
}

export type DriveFileMetadata = { id?: string; size?: string; mimeType?: string; trashed?: boolean;
  parents?: string[]; appProperties?: Record<string, string>; driveId?: string;
  permissions?: Array<{type?: string; role?: string}> };

export async function getDriveFile(token: string, id: string): Promise<DriveFileMetadata | null> {
  const response = await driveFetch(token, `files/${encodeURIComponent(id)}?fields=id,size,mimeType,trashed,parents,appProperties,driveId,permissions(type,role)`);
  if (response.status === 404) return null;
  if (!response.ok) throw new DriveArchiveError("PROVIDER_UNAVAILABLE");
  return response.json();
}

export function verifyDriveFile(file: DriveFileMetadata, expected: {id: string; size: bigint; mimeType: string; recordingId: string; folderId: string}, requirePrivate = true) {
  if (file.id !== expected.id || file.size !== String(expected.size) || file.mimeType !== expected.mimeType ||
      (requirePrivate ? file.trashed !== false : typeof file.trashed !== "boolean") ||
      !file.parents?.includes(expected.folderId) || file.appProperties?.clinicalRecording !== expected.recordingId) {
    throw new DriveArchiveError("INVALID_METADATA");
  }
  if (file.driveId || !file.permissions?.some((permission) => permission.type === "user" && permission.role === "owner") ||
      requirePrivate && file.permissions.some((permission) => permission.type !== "user" || permission.role !== "owner")) {
    throw new DriveArchiveError("INVALID_METADATA");
  }
}
