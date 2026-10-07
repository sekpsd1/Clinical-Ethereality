/* eslint-disable @typescript-eslint/no-require-imports */
import { afterEach, describe, expect, it, vi } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { loadConfig, run } = require("../../scripts/recording-archive-runner.cjs");
const dirs: string[] = [];
afterEach(() => { vi.unstubAllGlobals(); for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
describe("archive operator runner", () => {
  it("reads only minimal bounded private file configuration", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "archive-runner-")); dirs.push(dir);
    const file = path.join(dir, "runner.json");
    const config = { NEXT_PUBLIC_APP_URL: "https://app.bccgroup-thailand.com", GOOGLE_DRIVE_ARCHIVE_JOB_SECRET: "s".repeat(32) };
    fs.writeFileSync(file, JSON.stringify(config), { mode: 0o600 });
    expect(loadConfig(["--config", file])).toEqual(config);
    expect(() => loadConfig(["--config", "relative.json"])).toThrow();
    fs.writeFileSync(file, JSON.stringify({ ...config, GOOGLE_DRIVE_REFRESH_TOKEN: "excluded" }));
    expect(() => loadConfig(["--config", file])).toThrow();
    fs.writeFileSync(file, "x".repeat(4097));
    expect(() => loadConfig(["--config", file])).toThrow();
  });
  it("uses protected header, bounded request and no credential command arguments", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }); vi.stubGlobal("fetch", fetch);
    await run({ NEXT_PUBLIC_APP_URL: "https://app.bccgroup-thailand.com", GOOGLE_DRIVE_ARCHIVE_JOB_SECRET: "s".repeat(32) });
    expect(fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ method: "POST", redirect: "error", signal: expect.any(AbortSignal), headers: { "x-clinical-job-secret": "s".repeat(32) } }));
  });
});
