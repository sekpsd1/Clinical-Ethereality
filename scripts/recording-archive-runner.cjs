// Plesk scheduled task: invoke once per minute. Never prints secrets or provider payloads.
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
if (require.main === module) run().catch(() => { console.error("Archive step unavailable; inspect aggregate job status."); process.exitCode = 1; });
module.exports = { run };
