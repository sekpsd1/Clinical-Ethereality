// Operator-only synthetic test. Never reads DB, Zoom, or real recordings; never prints credentials/IDs.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

async function smoke(args = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (args[index] === "--recover-only") { options.recoverOnly = true; index -= 1; continue; }
    if (!["--config", "--recovery"].includes(args[index]) || !args[index + 1]) throw new Error("Invalid options.");
    options[args[index]] = args[index + 1];
  }
  for (const name of ["--config", "--recovery"]) {
    if (!options[name] || !path.isAbsolute(options[name]) || options[name].startsWith(`${process.cwd()}${path.sep}`)) throw new Error("Private absolute paths required.");
  }
  const config = JSON.parse(fs.readFileSync(options["--config"], "utf8"));
  if (!options.recoverOnly && fs.existsSync(options["--recovery"])) throw new Error("Recovery destination already exists.");
  const recovery = options.recoverOnly ? JSON.parse(fs.readFileSync(options["--recovery"], "utf8")) :
    { syntheticMarker: crypto.randomUUID(), folderId: config.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID, files: [] };
  const marker = recovery.syntheticMarker;
  if (!/^[0-9a-f-]{36}$/.test(marker) || recovery.folderId !== config.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID ||
      !Array.isArray(recovery.files) || recovery.files.some((entry) => !/^[A-Za-z0-9_-]+$/.test(entry.id) ||
        !Number.isSafeInteger(entry.size) || entry.size <= 0)) throw new Error("Invalid private recovery state.");
  for (const entry of recovery.files) if (entry.session) {
    const url = new URL(entry.session);
    if (url.origin !== "https://www.googleapis.com" || url.pathname !== "/upload/drive/v3/files" ||
        url.searchParams.get("uploadType") !== "resumable" || url.username || url.password || url.hash) throw new Error("Unsafe recovery capability.");
  }
  if (!options.recoverOnly) fs.writeFileSync(options["--recovery"], JSON.stringify(recovery), { flag: "wx", mode: 0o600 });
  const save = () => fs.writeFileSync(options["--recovery"], JSON.stringify(recovery), { mode: 0o600 });
  const report = { privateFolder: false, quotaKnown: false, sufficientQuota: false, uploaded: false,
    metadataVerified: false, bytesMatch: false, cancelledSessionTerminal: false, cancelledSessionCannotResume: false,
    completedSessionCannotResume: false, cleanupComplete: false, syntheticFilesRemaining: 0,
    stage: "authentication", errorType: "", causeCode: "", cleanupErrorType: "", cleanupCauseCode: "",
    httpStatus: { initialUpload: 0, interruptedStart: 0, interruptedChunk: 0, cancellation: 0,
      cancellationProbe: 0, cancellationResume: 0, cleanupSessionDelete: 0, cleanupSessionProbe: 0, cleanupFileDelete: 0 } };
  const classify = (error) => ({ type: ["TimeoutError", "AbortError", "TypeError"].includes(error?.name) ? error.name : "OtherError",
    code: /^(UND_ERR_[A-Z_]+|ETIMEDOUT|ECONNRESET|ECONNREFUSED)$/.test(error?.cause?.code || "") ? error.cause.code : "" });
  let token;
  const request = (url, init = {}) => fetch(url, { ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` }, redirect: init.redirect ?? "error", signal: AbortSignal.timeout(30_000) });
  const privatePermissions = (value) => !value.driveId && Array.isArray(value.permissions) && value.permissions.length > 0 &&
    value.permissions.every((p) => p.type === "user" && p.role === "owner");
  const metadata = async (id) => {
    const response = await request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,size,mimeType,trashed,parents,appProperties,driveId,permissions(type,role)`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Metadata unavailable.");
    return response.json();
  };
  const bound = (file, entry) => file.id === entry.id && file.appProperties?.clinicalSynthetic === marker &&
    file.parents?.includes(recovery.folderId) && file.mimeType === "text/plain" && privatePermissions(file);
  const begin = async (size) => {
    const generated = await request("https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files");
    if (!generated.ok) throw new Error("ID generation failed.");
    const data = await generated.json();
    if (!Array.isArray(data.ids) || !/^[A-Za-z0-9_-]+$/.test(data.ids[0])) throw new Error("Invalid ID.");
    const entry = { id: data.ids[0], size, session: null, cleaned: false }; recovery.files.push(entry); save();
    const response = await request("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", { method: "POST",
      headers: { "Content-Type": "application/json", "X-Upload-Content-Type": "text/plain", "X-Upload-Content-Length": String(size) },
      body: JSON.stringify({ id: entry.id, name: `clinical-archive-synthetic-${marker}.txt`, mimeType: "text/plain",
        parents: [recovery.folderId], appProperties: { clinicalSynthetic: marker } }) });
    const location = response.headers.get("location");
    if (size === 262145) report.httpStatus.interruptedStart = response.status;
    if (!response.ok || !location) throw new Error("Upload session unavailable.");
    const parsed = new URL(location);
    if (parsed.origin !== "https://www.googleapis.com" || parsed.pathname !== "/upload/drive/v3/files" || parsed.searchParams.get("uploadType") !== "resumable") throw new Error("Unsafe session.");
    entry.session = parsed.href; save(); return entry;
  };
  const probe = (entry) => request(entry.session, { method: "PUT", redirect: "manual", headers: { "Content-Range": `bytes */${entry.size}`, "Content-Length": "0" } });
  const terminal = (response) => [404, 410, 499].includes(response.status);
  try {
    const authenticated = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({
      client_id: config.GOOGLE_DRIVE_CLIENT_ID, client_secret: config.GOOGLE_DRIVE_CLIENT_SECRET,
      refresh_token: config.GOOGLE_DRIVE_REFRESH_TOKEN, grant_type: "refresh_token"
    }), redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!authenticated.ok) throw new Error("Authentication failed.");
    const auth = await authenticated.json();
    if (!auth.access_token || auth.scope !== "https://www.googleapis.com/auth/drive.file") throw new Error("Exact scope required.");
    token = auth.access_token;
    report.stage = "folder";
    const folderResponse = await request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(recovery.folderId)}?fields=id,mimeType,trashed,driveId,permissions(type,role)`);
    if (!folderResponse.ok) throw new Error("Folder unavailable.");
    const folder = await folderResponse.json();
    report.privateFolder = folder.id === recovery.folderId && folder.mimeType === "application/vnd.google-apps.folder" && !folder.trashed && privatePermissions(folder);
    if (!report.privateFolder) throw new Error("Destination is not private.");
    report.stage = "quota";
    const quotaResponse = await request("https://www.googleapis.com/drive/v3/about?fields=storageQuota");
    if (quotaResponse.ok) {
      const quota = (await quotaResponse.json()).storageQuota;
      report.quotaKnown = typeof quota?.limit === "string" && /^\d+$/.test(quota.limit) && /^\d+$/.test(quota.usage || "");
      report.sufficientQuota = report.quotaKnown && BigInt(quota.limit) - BigInt(quota.usage) > BigInt(1024 * 1024);
    }
    if (!options.recoverOnly) {
    report.stage = "initialUpload";
    const bytes = Buffer.from(`Synthetic archive test ${marker}\nNo patient information.\n`);
    const entry = await begin(bytes.length);
    const uploaded = await request(entry.session, { method: "PUT", redirect: "manual", headers: {
      "Content-Type": "text/plain", "Content-Length": String(bytes.length), "Content-Range": `bytes 0-${bytes.length - 1}/${bytes.length}` }, body: bytes });
    report.httpStatus.initialUpload = uploaded.status;
    report.uploaded = uploaded.ok;
    if (!report.uploaded) throw new Error("Synthetic upload failed.");
    report.stage = "metadata";
    const file = await metadata(entry.id);
    report.metadataVerified = Boolean(file && bound(file, entry) && file.size === String(bytes.length));
    if (!report.metadataVerified) throw new Error("Synthetic metadata mismatch.");
    report.stage = "download";
    const downloaded = await request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(entry.id)}?alt=media`);
    report.bytesMatch = downloaded.ok && Buffer.from(await downloaded.arrayBuffer()).equals(bytes);
    if (!report.bytesMatch) throw new Error("Synthetic bytes mismatch.");
    // Resume after completion must not alter the completed file or create another resource.
    report.stage = "completedResume";
    const completeResume = await request(entry.session, { method: "PUT", redirect: "manual", headers: { "Content-Type": "text/plain",
      "Content-Length": String(bytes.length), "Content-Range": `bytes 0-${bytes.length - 1}/${bytes.length}` }, body: Buffer.alloc(bytes.length, 66) });
    const completeFile = await metadata(entry.id);
    const afterResume = await request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(entry.id)}?alt=media`);
    report.completedSessionCannotResume = (terminal(completeResume) || [200, 201].includes(completeResume.status)) &&
      Boolean(completeFile && bound(completeFile, entry) && completeFile.size === String(bytes.length)) &&
      afterResume.ok && Buffer.from(await afterResume.arrayBuffer()).equals(bytes);
    // Interrupt a two-chunk non-sensitive synthetic TXT, then prove cancellation blocks resume.
    report.stage = "interruptedStart";
    const interrupted = await begin(262145);
    const first = Buffer.alloc(262144, 65);
    report.stage = "interruptedChunk";
    const firstResponse = await request(interrupted.session, { method: "PUT", redirect: "manual", headers: { "Content-Type": "text/plain",
      "Content-Length": String(first.length), "Content-Range": "bytes 0-262143/262145" }, body: first });
    report.httpStatus.interruptedChunk = firstResponse.status;
    if (firstResponse.status !== 308) throw new Error("Interrupted synthetic session not resumable.");
    report.stage = "cancellation";
    const cancelled = await request(interrupted.session, { method: "DELETE", redirect: "manual" });
    report.httpStatus.cancellation = cancelled.status;
    if (![200, 204, 404, 410, 499].includes(cancelled.status)) throw new Error("Cancellation unavailable.");
    report.stage = "cancellationProbe";
    const cancellationProbe = await probe(interrupted);
    report.httpStatus.cancellationProbe = cancellationProbe.status;
    report.cancelledSessionTerminal = terminal(cancellationProbe);
    report.stage = "cancellationResume";
    const resume = await request(interrupted.session, { method: "PUT", redirect: "manual", headers: { "Content-Type": "text/plain",
      "Content-Length": "1", "Content-Range": "bytes 262144-262144/262145" }, body: Buffer.from("B") });
    report.cancelledSessionCannotResume = terminal(resume);
    report.httpStatus.cancellationResume = resume.status;
    if (!report.cancelledSessionTerminal || !report.cancelledSessionCannotResume) throw new Error("Cancellation not proven.");
    }
  } catch (error) {
    const classified = classify(error); report.errorType = classified.type; report.causeCode = classified.code;
    throw error;
  } finally {
    if (token) for (const entry of recovery.files) {
      try {
        if (entry.session) {
          const removedSession = await request(entry.session, { method: "DELETE", redirect: "manual" });
          report.httpStatus.cleanupSessionDelete = removedSession.status;
          const status = await probe(entry);
          report.httpStatus.cleanupSessionProbe = status.status;
          if (!terminal(status) && ![200, 201].includes(status.status)) throw new Error("Session cleanup unverified.");
        }
        const file = await metadata(entry.id);
        if (file) {
          if (!bound(file, entry)) throw new Error("Refusing unbound synthetic deletion.");
          const removed = await request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(entry.id)}`, { method: "DELETE" });
          report.httpStatus.cleanupFileDelete = removed.status;
          if (removed.status !== 204 && removed.status !== 404) throw new Error("Synthetic cleanup failed.");
          if (await metadata(entry.id)) throw new Error("Synthetic cleanup unverified.");
        }
        entry.cleaned = true; save();
      } catch (error) { const classified = classify(error); report.cleanupErrorType = classified.type; report.cleanupCauseCode = classified.code; }
    }
    report.syntheticFilesRemaining = recovery.files.filter((entry) => !entry.cleaned).length;
    report.cleanupComplete = report.syntheticFilesRemaining === 0;
    console.log(JSON.stringify(report));
  }
  if (options.recoverOnly) { if (!report.cleanupComplete) throw new Error("Recovery incomplete."); return; }
  if (!report.privateFolder || !report.uploaded || !report.metadataVerified || !report.bytesMatch ||
      !report.cancelledSessionTerminal || !report.cancelledSessionCannotResume ||
      !report.cleanupComplete || !report.completedSessionCannotResume) throw new Error("Synthetic check incomplete.");
}
if (require.main === module) smoke().catch(() => { console.error("Synthetic check incomplete; private recovery state retained."); process.exitCode = 1; });
module.exports = { smoke };
