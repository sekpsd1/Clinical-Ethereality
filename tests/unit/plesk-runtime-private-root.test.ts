/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import { describe, expect, it } from "vitest";
const {
  INTERNAL_PLESK_APPLICATION_ROOT_ENV,
  resolvePleskApplicationRoot,
  resolveRuntimePrivateDestination,
  setPleskApplicationRoot
} = require("../../scripts/plesk-runtime-private-root.cjs");
const {
  SMS_OTP_REQUEST_STATUS_RELATIVE_PATH,
  writePleskSmsOtpRequestStatus
} = require("../../scripts/plesk-sms-otp-request-status.cjs");

function withTemporaryRoots(run: (applicationRoot: string, passengerCwd: string) => void) {
  const container = fs.mkdtempSync(path.join(os.tmpdir(), "sms-otp-runtime-root-"));
  const applicationRoot = path.join(container, "application");
  const passengerCwd = path.join(container, "passenger-cwd");
  fs.mkdirSync(applicationRoot, { recursive: true });
  fs.mkdirSync(passengerCwd, { recursive: true });

  try {
    run(applicationRoot, passengerCwd);
  } finally {
    fs.rmSync(container, { force: true, recursive: true });
  }
}

describe("Plesk runtime private root", () => {
  it("overwrites an external value with the wrapper application root", () => {
    const wrapperRoot = path.resolve("wrapper-application-root");
    const env = {
      [INTERNAL_PLESK_APPLICATION_ROOT_ENV]: path.resolve("external-value")
    };

    expect(setPleskApplicationRoot({ rootDir: wrapperRoot, env })).toBe(wrapperRoot);
    expect(env[INTERNAL_PLESK_APPLICATION_ROOT_ENV]).toBe(wrapperRoot);
  });

  it("uses the explicit wrapper root when Passenger cwd differs", () => {
    withTemporaryRoots((applicationRoot, passengerCwd) => {
      const env = {
        NODE_ENV: "production",
        [INTERNAL_PLESK_APPLICATION_ROOT_ENV]: applicationRoot
      };

      expect(
        resolvePleskApplicationRoot({ env, fallbackRootDir: passengerCwd })
      ).toBe(applicationRoot);

      const passengerDestination = writePleskSmsOtpRequestStatus({
        env,
        fallbackRootDir: passengerCwd,
        eventName: "diagnostics_probe_ready"
      });
      const probeDestination = writePleskSmsOtpRequestStatus({
        rootDir: applicationRoot,
        eventName: "diagnostics_probe_ready"
      });

      expect(passengerDestination).toBe(probeDestination);
      expect(path.relative(applicationRoot, passengerDestination)).toBe(
        SMS_OTP_REQUEST_STATUS_RELATIVE_PATH
      );
      expect(fs.existsSync(path.join(passengerCwd, "runtime-private"))).toBe(false);
      expect(path.relative(path.join(applicationRoot, "public"), passengerDestination)).toMatch(
        /^\.\./
      );
    });
  });

  it("fails closed in production without an explicit wrapper root", () => {
    expect(() =>
      resolvePleskApplicationRoot({
        env: { NODE_ENV: "production" },
        fallbackRootDir: path.resolve("unexpected-cwd")
      })
    ).toThrow("application root is unavailable");
  });

  it("allows cwd fallback only outside production", () => {
    const fallbackRoot = path.resolve("local-fallback-root");

    expect(
      resolvePleskApplicationRoot({
        env: { NODE_ENV: "test" },
        fallbackRootDir: fallbackRoot
      })
    ).toBe(fallbackRoot);
  });

  it("rejects relative explicit and internal roots", () => {
    expect(() => setPleskApplicationRoot({ rootDir: "relative-root", env: {} })).toThrow(
      "must be absolute"
    );
    expect(() =>
      resolvePleskApplicationRoot({
        env: {
          NODE_ENV: "production",
          [INTERNAL_PLESK_APPLICATION_ROOT_ENV]: "relative-root"
        }
      })
    ).toThrow("must be absolute");
  });

  it("rejects destinations outside runtime-private or inside public", () => {
    const applicationRoot = path.resolve("application-root");

    expect(() =>
      resolveRuntimePrivateDestination({
        applicationRoot,
        relativePath: "../public/status.json"
      })
    ).toThrow("destination is invalid");
    expect(() =>
      resolveRuntimePrivateDestination({
        applicationRoot,
        relativePath: "public/status.json"
      })
    ).toThrow("destination is invalid");
    expect(() =>
      resolveRuntimePrivateDestination({
        applicationRoot,
        relativePath: path.resolve("absolute-status.json")
      })
    ).toThrow("must be relative");
  });

  it("sets the wrapper root before loading startup and standalone runtime", () => {
    const serverSource = fs.readFileSync(path.resolve("server.js"), "utf8");
    const setRootIndex = serverSource.indexOf("setPleskApplicationRoot({ rootDir: __dirname");
    const startupIndex = serverSource.indexOf('require("./scripts/plesk-application-startup.cjs")');
    const standaloneIndex = serverSource.indexOf('require("./.next/standalone/server.js")');

    expect(setRootIndex).toBeGreaterThan(-1);
    expect(startupIndex).toBeGreaterThan(setRootIndex);
    expect(standaloneIndex).toBeGreaterThan(startupIndex);
  });
});
