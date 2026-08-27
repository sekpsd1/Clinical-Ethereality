/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");

const INTERNAL_PLESK_APPLICATION_ROOT_ENV = "__CE_PLESK_APPLICATION_ROOT";

function assertAbsoluteApplicationRoot(rootDir) {
  if (typeof rootDir !== "string" || !rootDir.trim() || !path.isAbsolute(rootDir)) {
    throw new Error("Plesk application root must be absolute.");
  }

  return path.resolve(rootDir);
}

function setPleskApplicationRoot({ rootDir, env = process.env }) {
  if (!env || typeof env !== "object") {
    throw new Error("Plesk application root environment is invalid.");
  }

  const resolvedRoot = assertAbsoluteApplicationRoot(rootDir);
  env[INTERNAL_PLESK_APPLICATION_ROOT_ENV] = resolvedRoot;
  return resolvedRoot;
}

function resolvePleskApplicationRoot({
  rootDir,
  env = process.env,
  nodeEnv = env?.NODE_ENV,
  fallbackRootDir = process.cwd()
} = {}) {
  if (rootDir !== undefined) {
    return assertAbsoluteApplicationRoot(rootDir);
  }

  const internalRoot = env?.[INTERNAL_PLESK_APPLICATION_ROOT_ENV];
  if (internalRoot !== undefined) {
    return assertAbsoluteApplicationRoot(internalRoot);
  }

  if (nodeEnv !== "production") {
    return assertAbsoluteApplicationRoot(fallbackRootDir);
  }

  throw new Error("Plesk application root is unavailable.");
}

function resolveRuntimePrivateDestination({ applicationRoot, relativePath }) {
  const resolvedRoot = assertAbsoluteApplicationRoot(applicationRoot);
  if (typeof relativePath !== "string" || !relativePath || path.isAbsolute(relativePath)) {
    throw new Error("Runtime-private destination must be relative.");
  }

  const directory = path.resolve(resolvedRoot, "runtime-private");
  const destination = path.resolve(resolvedRoot, relativePath);
  const publicDirectory = path.resolve(resolvedRoot, "public");
  const privateRelative = path.relative(directory, destination);
  const publicRelative = path.relative(publicDirectory, destination);
  const outsidePrivate =
    !privateRelative ||
    privateRelative === ".." ||
    privateRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(privateRelative);
  const insidePublic =
    !publicRelative ||
    (publicRelative !== ".." &&
      !publicRelative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(publicRelative));
  if (outsidePrivate || insidePublic) {
    throw new Error("Runtime-private destination is invalid.");
  }

  return { directory, destination };
}

module.exports = {
  INTERNAL_PLESK_APPLICATION_ROOT_ENV,
  assertAbsoluteApplicationRoot,
  resolvePleskApplicationRoot,
  resolveRuntimePrivateDestination,
  setPleskApplicationRoot
};
