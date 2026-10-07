// One-time operator tool. Run only after separate Google configuration/grant approval.
const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

async function setup(env = process.env, args = process.argv.slice(2)) {
  let clientId = env.GOOGLE_DRIVE_CLIENT_ID;
  let clientSecret = env.GOOGLE_DRIVE_CLIENT_SECRET;
  let output = env.GOOGLE_DRIVE_ARCHIVE_SETUP_OUTPUT;
  for (let index = 0; index < args.length; index += 2) {
    if (!args[index + 1]) throw new Error("Invalid setup arguments.");
    if (args[index] === "--client-json") {
      const json = JSON.parse(fs.readFileSync(args[index + 1], "utf8"));
      if (!json.web || !json.web.redirect_uris?.includes("http://127.0.0.1:53682/oauth/callback")) {
        throw new Error("Web OAuth client with registered loopback redirect required.");
      }
      clientId = json.web.client_id; clientSecret = json.web.client_secret;
    } else if (args[index] === "--output") output = args[index + 1];
    else throw new Error("Invalid setup arguments.");
  }
  if (!clientId || !clientSecret || !output || !path.isAbsolute(output) ||
      output.startsWith(`${process.cwd()}${path.sep}`) || fs.existsSync(output)) {
    throw new Error("Provide OAuth credentials and a new absolute private output path outside the repository.");
  }
  // The operator creates/protects the parent directory beforehand; never creates public directories.
  const parent = fs.lstatSync(path.dirname(output));
  if (!parent.isDirectory() || parent.isSymbolicLink()) throw new Error("Private output parent required.");
  const redirect = "http://127.0.0.1:53682/oauth/callback";
  const state = crypto.randomBytes(32).toString("base64url");
  const verifier = crypto.randomBytes(32).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.file", access_type: "offline", prompt: "consent",
    state, code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256" }).toString();
  await new Promise((resolve, reject) => {
    let handling = false;
    const server = http.createServer(async (request, response) => {
      const callback = new URL(request.url || "/", redirect);
      if (request.method !== "GET" || callback.pathname !== "/oauth/callback" ||
          callback.searchParams.get("state") !== state || !callback.searchParams.get("code") || handling) {
        response.writeHead(400, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
        response.end("Invalid setup request."); return;
      }
      handling = true;
      try {
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST",
          body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, client_secret: clientSecret,
            code: callback.searchParams.get("code"), redirect_uri: redirect, code_verifier: verifier }),
          redirect: "error", signal: AbortSignal.timeout(15_000) });
        if (!tokenResponse.ok) throw new Error("OAuth setup failed.");
        const token = await tokenResponse.json();
        if (!token.access_token || !token.refresh_token || token.scope !== "https://www.googleapis.com/auth/drive.file") {
          throw new Error("Offline drive.file grant required.");
        }
        const folderResponse = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", { method: "POST",
          headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Clinical Lab Consultation Recordings", mimeType: "application/vnd.google-apps.folder" }),
          redirect: "error", signal: AbortSignal.timeout(15_000) });
        if (!folderResponse.ok) throw new Error("Private destination setup failed.");
        const folder = await folderResponse.json();
        if (typeof folder.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(folder.id)) throw new Error("Invalid destination.");
        fs.writeFileSync(output, JSON.stringify({ GOOGLE_DRIVE_CLIENT_ID: clientId, GOOGLE_DRIVE_CLIENT_SECRET: clientSecret,
          GOOGLE_DRIVE_REFRESH_TOKEN: token.refresh_token, GOOGLE_DRIVE_ARCHIVE_FOLDER_ID: folder.id,
          GOOGLE_DRIVE_ARCHIVE_SESSION_KEY: crypto.randomBytes(32).toString("hex"),
          GOOGLE_DRIVE_ARCHIVE_JOB_SECRET: crypto.randomBytes(32).toString("base64url") }, null, 2), { flag: "wx", mode: 0o600 });
        response.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
        response.end("Setup complete. Close this tab. The private configuration is saved for the operator.");
        console.log("Private configuration saved. Do not paste its contents into chat or commit it.");
        clearTimeout(timer); server.close(); resolve();
      } catch {
        response.writeHead(500, { "Content-Type": "text/plain", "Cache-Control": "no-store" }); response.end("Setup failed. Contact the operator.");
        clearTimeout(timer); server.close(); reject(new Error("Setup failed; inspect folder state before retrying."));
      }
    });
    const timer = setTimeout(() => { server.close(); reject(new Error("Setup expired.")); }, 10 * 60_000);
    server.on("error", () => { clearTimeout(timer); reject(new Error("Local callback unavailable.")); });
    server.listen(53682, "127.0.0.1", () => { console.log("Sign in as the approved archive account at this authorization URL:"); console.log(url.href); });
  });
}
if (require.main === module) setup().catch(() => { console.error("Archive setup did not complete. No credential values were printed."); process.exitCode = 1; });
module.exports = { setup };
