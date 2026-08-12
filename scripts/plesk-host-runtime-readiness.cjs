const fs = require("node:fs");
const path = require("node:path");

const RECOVERY_COMMAND = "npm run build:plesk-host";

function failReadiness(message) {
  throw new Error(`[plesk-runtime] ${message}. Run ${RECOVERY_COMMAND} before restarting the app.`);
}

function assertFile(targetPath, label) {
  if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
    failReadiness(`${label} is missing`);
  }
}

function assertDirectory(targetPath, label) {
  if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) {
    failReadiness(`${label} is missing`);
  }
}

function collectFileSizes(rootDir) {
  const files = new Map();

  function visit(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }

      if (!entry.isFile() && !entry.isSymbolicLink()) {
        continue;
      }

      const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join("/");
      files.set(relativePath, fs.statSync(absolutePath).size);
    }
  }

  visit(rootDir);
  return files;
}

function assertMirroredDirectory(sourceDir, destinationDir, label) {
  assertDirectory(sourceDir, `${label} source`);
  assertDirectory(destinationDir, `${label} destination`);

  const sourceFiles = collectFileSizes(sourceDir);
  const destinationFiles = collectFileSizes(destinationDir);

  if (sourceFiles.size === 0) {
    failReadiness(`${label} source is empty`);
  }

  if (sourceFiles.size !== destinationFiles.size) {
    failReadiness(
      `${label} file count differs (${sourceFiles.size} source, ${destinationFiles.size} destination)`,
    );
  }

  for (const [relativePath, sourceSize] of sourceFiles) {
    const destinationSize = destinationFiles.get(relativePath);

    if (destinationSize === undefined) {
      failReadiness(`${label} is missing ${relativePath}`);
    }

    if (destinationSize !== sourceSize) {
      failReadiness(`${label} size differs for ${relativePath}`);
    }
  }

  return sourceFiles.size;
}

function assertPleskHostRuntimeReady({ rootDir = process.cwd() } = {}) {
  const standaloneDir = path.join(rootDir, ".next", "standalone");
  const standaloneNextDir = path.join(standaloneDir, ".next");

  assertFile(path.join(standaloneDir, "server.js"), "Next standalone server");
  assertFile(path.join(standaloneNextDir, "BUILD_ID"), "Next standalone BUILD_ID");

  const staticFileCount = assertMirroredDirectory(
    path.join(rootDir, ".next", "static"),
    path.join(standaloneNextDir, "static"),
    "Next standalone static assets",
  );
  const publicFileCount = assertMirroredDirectory(
    path.join(rootDir, "public"),
    path.join(standaloneDir, "public"),
    "Next standalone public assets",
  );

  return {
    publicFileCount,
    staticFileCount,
  };
}

module.exports = {
  RECOVERY_COMMAND,
  assertMirroredDirectory,
  assertPleskHostRuntimeReady,
  collectFileSizes,
};
