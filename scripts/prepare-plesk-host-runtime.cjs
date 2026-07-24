const fs = require("node:fs");
const path = require("node:path");

const workspace = process.cwd();
const standaloneDir = path.join(workspace, ".next", "standalone");
const nextStaticDir = path.join(workspace, ".next", "static");
const publicDir = path.join(workspace, "public");

function assertExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} not found: ${path.relative(workspace, targetPath)}`);
  }
}

function replaceDirectory(source, destination, label) {
  assertExists(source, label);
  fs.rmSync(destination, { force: true, recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

assertExists(path.join(standaloneDir, "server.js"), "Next standalone server");

replaceDirectory(nextStaticDir, path.join(standaloneDir, ".next", "static"), "Next static assets");
replaceDirectory(publicDir, path.join(standaloneDir, "public"), "Public assets");

console.log("Plesk host runtime prepared at .next/standalone");
