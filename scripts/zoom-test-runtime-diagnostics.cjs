/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { getBinaryTargetForCurrentPlatform } = require("@prisma/get-platform");

async function getZoomTestRuntimeDiagnostics({
  rootDir = process.cwd(),
  getBinaryTarget = getBinaryTargetForCurrentPlatform,
  readDirectory = fs.readdirSync,
  versions = process.versions,
  platform = process.platform,
  arch = process.arch
} = {}) {
  const binaryTarget = await getBinaryTarget();
  const clientDirectory = path.join(rootDir, "node_modules", ".prisma", "client");
  let clientFiles = [];
  try {
    clientFiles = readDirectory(clientDirectory);
  } catch {
    clientFiles = [];
  }
  const queryEnginePresent = clientFiles.some((file) =>
    file.includes(binaryTarget) && /query_engine|libquery_engine/.test(file)
  );
  return {
    status: queryEnginePresent ? "ready" : "not_ready",
    node: String(versions.node ?? "").split(".").slice(0, 2).join("."),
    openssl: String(versions.openssl ?? "").split(".")[0] || "unknown",
    platform,
    arch,
    binaryTarget,
    queryEnginePresent
  };
}

async function main() {
  console.log(JSON.stringify(await getZoomTestRuntimeDiagnostics()));
}

if (require.main === module) {
  main().catch(() => {
    console.error(JSON.stringify({ status: "error", code: "RUNTIME_DIAGNOSTIC_FAILED" }));
    process.exitCode = 1;
  });
}

module.exports = { getZoomTestRuntimeDiagnostics };
