// Plesk scheduled task, once per minute. Configure through its private environment.
async function run(env = process.env) {
  const secret = env.LINE_BOOKING_ALERT_JOB_SECRET;
  const base = new URL(env.NEXT_PUBLIC_APP_URL);
  if (!secret || secret.length < 32 || base.protocol !== "https:" || base.username || base.password) {
    throw new Error("LINE booking alert runner is not configured.");
  }
  const response = await fetch(new URL("/api/jobs/line-booking-alerts", base), {
    method: "POST", headers: { "x-clinical-job-secret": secret },
    redirect: "error", signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok || !(await response.json()).ok) throw new Error("LINE booking alerts require attention.");
  console.log("LINE booking alert job completed.");
}
if (require.main === module) run().catch(() => {
  console.error("LINE booking alerts unavailable; inspect aggregate job status.");
  process.exitCode = 1;
});
module.exports = { run };
