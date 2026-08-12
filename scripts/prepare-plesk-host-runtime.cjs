const fs = require("node:fs");
const path = require("node:path");
const { assertPleskHostRuntimeReady } = require("./plesk-host-runtime-readiness.cjs");

function assertExists(targetPath, label, workspace) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} not found: ${path.relative(workspace, targetPath)}`);
  }
}

function replaceDirectory(source, destination, label, workspace) {
  assertExists(source, label, workspace);
  fs.rmSync(destination, { force: true, recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

function preparePleskHostRuntime({ workspace = process.cwd(), log = console.log } = {}) {
  const standaloneDir = path.join(workspace, ".next", "standalone");
  const nextStaticDir = path.join(workspace, ".next", "static");
  const publicDir = path.join(workspace, "public");

  assertExists(path.join(standaloneDir, "server.js"), "Next standalone server", workspace);

  replaceDirectory(
    nextStaticDir,
    path.join(standaloneDir, ".next", "static"),
    "Next static assets",
    workspace,
  );
  replaceDirectory(publicDir, path.join(standaloneDir, "public"), "Public assets", workspace);

  const readiness = assertPleskHostRuntimeReady({ rootDir: workspace });
  log(
    `Plesk host runtime prepared at .next/standalone (${readiness.staticFileCount} static files, ${readiness.publicFileCount} public files verified)`,
  );

  return readiness;
}

if (require.main === module) {
  preparePleskHostRuntime();
}

module.exports = {
  preparePleskHostRuntime,
  replaceDirectory,
};
