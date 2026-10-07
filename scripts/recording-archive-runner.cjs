// Plesk scheduled task: invoke once per minute. Never prints secrets or provider payloads.
const fs = require("node:fs");
const path = require("node:path");
function loadConfig(args = process.argv.slice(2), env = process.env) {
  if (!args.length) return env;
  if (args.length !== 2 || args[0] !== "--config" || !path.isAbsolute(args[1])) throw new Error("Invalid runner configuration.");
  const stats = fs.lstatSync(args[1]);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size > 4096 || (process.platform !== "win32" && (stats.mode & 0o077))) throw new Error("Runner configuration must be private.");
  const config = JSON.parse(fs.readFileSync(args[1], "utf8"));
  if (!config || typeof config !== "object" || Object.keys(config).some(key => !["NEXT_PUBLIC_APP_URL", "GOOGLE_DRIVE_ARCHIVE_JOB_SECRET"].includes(key))) throw new Error("Invalid runner configuration.");
  return config;
}
async function run(env = process.env) {
  const secret = env.GOOGLE_DRIVE_ARCHIVE_JOB_SECRET;
  const base = new URL(env.NEXT_PUBLIC_APP_URL || "https://app.bccgroup-thailand.com");
  if (!secret || secret.length < 32 || base.protocol !== "https:" || base.username || base.password) {
    throw new Error("Archive runner is not configured.");
  }
  const response = await fetch(new URL("/api/jobs/recording-archive", base), {
    method: "POST", headers: { "x-clinical-job-secret": secret },
    redirect: "error", signal: AbortSignal.timeout(150_000)
  });
  if (!response.ok) throw new Error("Archive step requires operator attention.");
  const result = await response.json();
  if (!result.ok) throw new Error("Archive step requires operator attention.");
  console.log("Archive step completed.");
}
if (require.main === module) Promise.resolve().then(() => run(loadConfig())).catch(() => { console.error("Archive step unavailable; inspect aggregate job status."); process.exitCode = 1; });
module.exports = { run, loadConfig };
