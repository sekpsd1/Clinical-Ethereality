/* eslint-disable @typescript-eslint/no-require-imports */
const { setPleskApplicationRoot } = require("./scripts/plesk-runtime-private-root.cjs");

setPleskApplicationRoot({ rootDir: __dirname, env: process.env });

const { startPleskApplication } = require("./scripts/plesk-application-startup.cjs");

startPleskApplication({
  rootDir: __dirname,
  startStandalone: () => require("./.next/standalone/server.js")
}).catch(() => {
  console.error("[plesk-startup] Application startup stopped by a fail-closed runtime guard.");
  process.exitCode = 1;
});
