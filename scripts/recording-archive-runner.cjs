// Plesk scheduled task: invoke once per minute. Never prints secrets or provider payloads.
const fs = require("node:fs");
const path = require("node:path");
function validateTarget(target) {
  const keys = ["recordingId", "consultationId", "providerRecordingId", "zoomMeetingId", "fileSizeBytes", "fileType", "recordingType"];
  if (!target || typeof target !== "object" || Array.isArray(target) || Object.keys(target).length !== keys.length ||
    Object.keys(target).some(key => !keys.includes(key)) || keys.slice(0, 4).some(key =>
      typeof target[key] !== "string" || !/^[A-Za-z0-9_+=/.-]{1,191}$/.test(target[key])) ||
    typeof target.fileSizeBytes !== "string" || !/^[1-9][0-9]{0,15}$/.test(target.fileSizeBytes) ||
    BigInt(target.fileSizeBytes) > BigInt(Number.MAX_SAFE_INTEGER) ||
    !(target.fileType === "mp4" && target.recordingType === "shared_screen_with_speaker_view" ||
      target.fileType === "txt" && target.recordingType === "chat_file")) throw new Error("Invalid runner target.");
  return target;
}
function loadConfig(args = process.argv.slice(2), env = process.env) {
  if (!args.length) return env;
  if (args.length !== 2 || args[0] !== "--config" || !path.isAbsolute(args[1])) throw new Error("Invalid runner configuration.");
  const stats = fs.lstatSync(args[1]);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size > 4096 || (process.platform !== "win32" && (stats.mode & 0o077))) throw new Error("Runner configuration must be private.");
  const config = JSON.parse(fs.readFileSync(args[1], "utf8"));
  if (!config || typeof config !== "object" || Object.keys(config).some(key => !["NEXT_PUBLIC_APP_URL", "GOOGLE_DRIVE_ARCHIVE_JOB_SECRET", "target"].includes(key))) throw new Error("Invalid runner configuration.");
  if (config.target !== undefined) {
    validateTarget(config.target);
    const parent = fs.realpathSync(path.dirname(args[1]));
    const repository = fs.realpathSync(path.join(__dirname, ".."));
    const normalize = value => process.platform === "win32" ? value.toLowerCase() : value;
    if (normalize(parent) === normalize(repository) || normalize(parent).startsWith(normalize(repository) + path.sep) ||
      process.platform !== "win32" && (fs.statSync(parent).mode & 0o077)) throw new Error("Private external target configuration required.");
  }
  return config;
}
async function run(env = process.env) {
  const secret = env.GOOGLE_DRIVE_ARCHIVE_JOB_SECRET;
  const base = new URL(env.NEXT_PUBLIC_APP_URL || "https://app.bccgroup-thailand.com");
  if (!secret || secret.length < 32 || base.protocol !== "https:" || base.username || base.password) {
    throw new Error("Archive runner is not configured.");
  }
  const target = env.target !== undefined ? validateTarget(env.target) : undefined;
  if (target && base.origin !== "https://app.bccgroup-thailand.com") throw new Error("Invalid target destination.");
  const response = await fetch(new URL("/api/jobs/recording-archive", base), {
    method: "POST", headers: { "x-clinical-job-secret": secret, ...(target ? { "Content-Type": "application/json" } : {}) },
    ...(target ? { body: JSON.stringify({ target }) } : {}),
    redirect: "error", signal: AbortSignal.timeout(150_000)
  });
  if (!response.ok) throw new Error("Archive step requires operator attention.");
  const result = await response.json();
  if (!result.ok) throw new Error("Archive step requires operator attention.");
  if (target && (result.result?.targetMatched !== true || !["progress", "archived"].includes(result.result?.status))) {
    throw new Error("Archive target requires operator attention.");
  }
  console.log("Archive step completed.");
}
if (require.main === module) Promise.resolve().then(() => run(loadConfig())).catch(() => { console.error("Archive step unavailable; inspect aggregate job status."); process.exitCode = 1; });
module.exports = { run, loadConfig, validateTarget };
