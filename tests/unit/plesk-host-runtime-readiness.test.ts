/* eslint-disable @typescript-eslint/no-require-imports */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  RECOVERY_COMMAND,
  assertPleskHostRuntimeReady,
} = require("../../scripts/plesk-host-runtime-readiness.cjs");
const {
  preparePleskHostRuntime,
} = require("../../scripts/prepare-plesk-host-runtime.cjs");

const workspaces: string[] = [];

function createWorkspace() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "plesk-host-runtime-"));
  workspaces.push(workspace);

  fs.mkdirSync(path.join(workspace, ".next", "standalone", ".next"), { recursive: true });
  fs.mkdirSync(path.join(workspace, ".next", "static", "chunks", "app", "admin", "users"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(workspace, "public", "zoom-sdk"), { recursive: true });

  fs.writeFileSync(path.join(workspace, ".next", "standalone", "server.js"), "// server\n");
  fs.writeFileSync(path.join(workspace, ".next", "standalone", ".next", "BUILD_ID"), "build-id\n");
  fs.writeFileSync(
    path.join(workspace, ".next", "static", "chunks", "app", "admin", "users", "page-test.js"),
    "console.log('chunk');\n",
  );
  fs.writeFileSync(path.join(workspace, "public", "zoom-sdk", "index.html"), "<main>Zoom</main>\n");

  return workspace;
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    fs.rmSync(workspace, { force: true, recursive: true });
  }
});

describe("Plesk host runtime readiness", () => {
  it("copies and verifies static and public assets for the standalone runtime", () => {
    const workspace = createWorkspace();
    const log = vi.fn();

    expect(preparePleskHostRuntime({ workspace, log })).toEqual({
      publicFileCount: 1,
      staticFileCount: 1,
    });
    expect(assertPleskHostRuntimeReady({ rootDir: workspace })).toEqual({
      publicFileCount: 1,
      staticFileCount: 1,
    });
    expect(
      fs.existsSync(
        path.join(
          workspace,
          ".next",
          "standalone",
          ".next",
          "static",
          "chunks",
          "app",
          "admin",
          "users",
          "page-test.js",
        ),
      ),
    ).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("1 static files"));
  });

  it("fails closed when the standalone static directory was not prepared", () => {
    const workspace = createWorkspace();

    expect(() => assertPleskHostRuntimeReady({ rootDir: workspace })).toThrow(
      expect.objectContaining({ message: expect.stringContaining(RECOVERY_COMMAND) }),
    );
  });

  it("fails closed when a copied page chunk is missing", () => {
    const workspace = createWorkspace();
    preparePleskHostRuntime({ workspace, log: vi.fn() });
    fs.rmSync(
      path.join(
        workspace,
        ".next",
        "standalone",
        ".next",
        "static",
        "chunks",
        "app",
        "admin",
        "users",
        "page-test.js",
      ),
    );

    expect(() => assertPleskHostRuntimeReady({ rootDir: workspace })).toThrow(
      expect.objectContaining({ message: expect.stringContaining("static assets") }),
    );
  });
});
