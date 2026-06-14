const fs = require("node:fs");
const path = require("node:path");

const workspace = process.cwd();
const nextStandaloneDir = path.join(workspace, ".next", "standalone");
const nextStaticDir = path.join(workspace, ".next", "static");
const publicDir = path.join(workspace, "public");
const outputDir = path.join(workspace, "deploy", "plesk");

function assertInsideWorkspace(targetPath) {
  const resolvedWorkspace = path.resolve(workspace);
  const resolvedTarget = path.resolve(targetPath);

  if (!resolvedTarget.startsWith(resolvedWorkspace)) {
    throw new Error(`Refusing to write outside workspace: ${resolvedTarget}`);
  }
}

function assertExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} not found: ${path.relative(workspace, targetPath)}`);
  }
}

function copyRequiredDir(source, destination, label) {
  assertExists(source, label);
  fs.cpSync(source, destination, {
    recursive: true
  });
}

function verifyArtifact() {
  const requiredPaths = [
    ["server.js", path.join(outputDir, "server.js")],
    ["package.json", path.join(outputDir, "package.json")],
    [".next/static", path.join(outputDir, ".next", "static")],
    ["public", path.join(outputDir, "public")]
  ];

  for (const [label, targetPath] of requiredPaths) {
    assertExists(targetPath, label);
  }
}

assertExists(path.join(nextStandaloneDir, "server.js"), ".next standalone server");
assertExists(nextStaticDir, ".next static assets");
assertExists(publicDir, "public assets");

assertInsideWorkspace(outputDir);
fs.rmSync(outputDir, {
  force: true,
  recursive: true
});
fs.mkdirSync(path.join(outputDir, ".next"), {
  recursive: true
});

copyRequiredDir(nextStandaloneDir, outputDir, ".next standalone output");
copyRequiredDir(nextStaticDir, path.join(outputDir, ".next", "static"), ".next static assets");
copyRequiredDir(publicDir, path.join(outputDir, "public"), "public assets");

verifyArtifact();

console.log("Plesk artifact prepared at deploy/plesk");
console.log("Upload the contents of deploy/plesk to the Plesk application root.");
