const fs = require("node:fs");
const path = require("node:path");

const workspace = process.cwd();
const nextStandaloneDir = path.join(workspace, ".next", "standalone");
const nextStaticDir = path.join(workspace, ".next", "static");
const publicDir = path.join(workspace, "public");
const outputDir = path.join(workspace, "deploy", "plesk");
const prismaClientSourceDir = path.join(workspace, "node_modules", ".prisma", "client");
const prismaEngines = [
  "libquery_engine-debian-openssl-3.0.x.so.node",
  "libquery_engine-rhel-openssl-3.0.x.so.node"
];

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

  const prismaClientDir = path.join(outputDir, "node_modules", ".prisma", "client");
  assertExists(prismaClientDir, "Prisma Client");

  for (const engine of prismaEngines) {
    assertExists(path.join(prismaClientDir, engine), `Prisma engine (${engine})`);
  }
}

assertExists(path.join(nextStandaloneDir, "server.js"), ".next standalone server");
assertExists(nextStaticDir, ".next static assets");
assertExists(publicDir, "public assets");
assertExists(prismaClientSourceDir, "generated Prisma Client");

for (const engine of prismaEngines) {
  assertExists(path.join(prismaClientSourceDir, engine), `generated Prisma engine (${engine})`);
}

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

const prismaClientDestinationDir = path.join(outputDir, "node_modules", ".prisma", "client");
for (const engine of prismaEngines) {
  fs.copyFileSync(path.join(prismaClientSourceDir, engine), path.join(prismaClientDestinationDir, engine));
}

verifyArtifact();

console.log("Plesk artifact prepared at deploy/plesk");
console.log("Upload the contents of deploy/plesk to the Plesk application root.");
