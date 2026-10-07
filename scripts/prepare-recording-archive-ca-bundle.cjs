/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const tls = require("node:tls");
const crypto = require("node:crypto");
function prepareCaBundle(args = process.argv.slice(2)) {
  if (args.length !== 2 || args[0] !== "--output" || !path.isAbsolute(args[1])) throw new Error("Invalid destination");
  const normalize = value => process.platform === "win32" ? value.toLowerCase() : value;
  const parent = normalize(fs.realpathSync(path.dirname(args[1])));
  const repository = normalize(fs.realpathSync(path.join(__dirname, "..")));
  if (parent === repository || parent.startsWith(repository + path.sep)) throw new Error("External destination required");
  const content = tls.rootCertificates.join("\n") + "\n";
  fs.writeFileSync(args[1], content, { mode: 0o600, flag: "wx" });
  return { source: "installed-node-bundled-mozilla-roots", nodeVersion: process.version, certificateCount: tls.rootCertificates.length, sha256: crypto.createHash("sha256").update(content).digest("hex") };
}
if (require.main === module) {
  try { console.log(JSON.stringify(prepareCaBundle())); }
  catch { console.error("Trusted CA preparation failed."); process.exitCode = 1; }
}
module.exports = { prepareCaBundle };
