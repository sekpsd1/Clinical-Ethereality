/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, expect, it } from "vitest";
const {
  getZoomTestRuntimeDiagnostics
} = require("../../scripts/zoom-test-runtime-diagnostics.cjs");

describe("Zoom Test runtime diagnostics", () => {
  it("reports only allowlisted runtime compatibility fields", async () => {
    const result = await getZoomTestRuntimeDiagnostics({
      rootDir: "C:/test-app",
      getBinaryTarget: async () => "rhel-openssl-3.0.x",
      readDirectory: () => ["libquery_engine-rhel-openssl-3.0.x.so.node"],
      versions: { node: "20.20.2", openssl: "3.0.18" },
      platform: "linux",
      arch: "x64"
    });

    expect(result).toEqual({
      status: "ready",
      node: "20.20",
      openssl: "3",
      platform: "linux",
      arch: "x64",
      binaryTarget: "rhel-openssl-3.0.x",
      queryEnginePresent: true
    });
  });

  it("fails closed when the detected query engine is absent", async () => {
    const result = await getZoomTestRuntimeDiagnostics({
      rootDir: "C:/test-app",
      getBinaryTarget: async () => "rhel-openssl-1.1.x",
      readDirectory: () => ["libquery_engine-rhel-openssl-3.0.x.so.node"],
      versions: { node: "20.20.2", openssl: "1.1.1" },
      platform: "linux",
      arch: "x64"
    });

    expect(result.status).toBe("not_ready");
    expect(result.queryEnginePresent).toBe(false);
  });
});
