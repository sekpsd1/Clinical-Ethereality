/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

function prepareRunnerConfig(argv = process.argv.slice(2)) {
  const curl = argv.length === 5 && argv[4] === "--curl";
  if ((!curl && argv.length !== 4) || argv[0] !== "--config" || argv[2] !== "--output") throw new Error("Invalid arguments");
  const [input, output] = [argv[1], argv[3]];
  if (!path.isAbsolute(input) || !path.isAbsolute(output)) throw new Error("Absolute paths required");
  const parent = fs.realpathSync(path.dirname(input));
  const normalize = value => process.platform === "win32" ? value.toLowerCase() : value;
  const repository = normalize(fs.realpathSync(path.join(__dirname, "..")));
  const normalizedParent = normalize(parent);
  if (normalize(fs.realpathSync(path.dirname(output))) !== normalizedParent || normalizedParent === repository || normalizedParent.startsWith(repository + path.sep)) throw new Error("Protected external parent required");
  const stat = fs.lstatSync(input);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536 || (process.platform !== "win32" && (stat.mode & 0o077))) throw new Error("Private input required");
  const config = JSON.parse(fs.readFileSync(input, "utf8"));
  const secret = config.GOOGLE_DRIVE_ARCHIVE_JOB_SECRET;
  if (typeof secret !== "string" || !/^[A-Za-z0-9_-]{32,512}$/.test(secret)) throw new Error("Invalid configuration");
  const content = curl
    ? `url = "https://app.bccgroup-thailand.com/api/jobs/recording-archive"\nrequest = "POST"\nheader = "x-clinical-job-secret: ${secret}"\n`
    : JSON.stringify({ NEXT_PUBLIC_APP_URL: "https://app.bccgroup-thailand.com", GOOGLE_DRIVE_ARCHIVE_JOB_SECRET: secret });
  fs.writeFileSync(output, content, { flag: "wx", mode: 0o600 });
}

if (require.main === module) {
  try { prepareRunnerConfig(); console.log("Runner configuration prepared privately."); }
  catch { console.error("Runner configuration preparation failed."); process.exitCode = 1; }
}
module.exports = { prepareRunnerConfig };
