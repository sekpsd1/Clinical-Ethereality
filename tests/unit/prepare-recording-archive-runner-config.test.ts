/* eslint-disable @typescript-eslint/no-require-imports */
import { afterEach, expect, it } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { prepareRunnerConfig } = require("../../scripts/prepare-recording-archive-runner-config.cjs");
const roots: string[] = [];
it("exports exact target as escaped JSON curl data or minimal private JSON", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "archive-target-config-")); roots.push(root);
  const input = path.join(root, "input.json");
  const target = { recordingId: "recording-test", consultationId: "consult-test", providerRecordingId: "provider-test",
    zoomMeetingId: "meeting-test", fileSizeBytes: "4", fileType: "mp4", recordingType: "shared_screen_with_speaker_view" };
  fs.writeFileSync(input, JSON.stringify({ GOOGLE_DRIVE_ARCHIVE_JOB_SECRET: "a".repeat(48), target }), { mode: 0o600 });
  const curl = path.join(root, "job.curl"), json = path.join(root, "job.json");
  prepareRunnerConfig(["--config", input, "--output", curl, "--curl"]);
  const text = fs.readFileSync(curl, "utf8");
  const dataLine = text.split("\n").find((line: string) => line.startsWith("data = "));
  expect(JSON.parse(JSON.parse(dataLine.slice(7)))).toEqual({ target });
  expect(text).toContain('header = "Content-Type: application/json"');
  prepareRunnerConfig(["--config", input, "--output", json]);
  expect(JSON.parse(fs.readFileSync(json, "utf8")).target).toEqual(target);
  if (process.platform !== "win32") expect(fs.statSync(curl).mode & 0o777).toBe(0o600);
  fs.writeFileSync(input, JSON.stringify({ GOOGLE_DRIVE_ARCHIVE_JOB_SECRET: "a".repeat(48), target: { ...target, zoomMeetingId: "bad\nheader" } }));
  expect(() => prepareRunnerConfig(["--config", input, "--output", path.join(root, "bad.json")])).toThrow();
});
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
it("writes only bounded canonical curl job configuration exclusively", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "archive-runner-config-test-")); roots.push(root);
  const input = path.join(root, "input.json"), output = path.join(root, "job.curl");
  fs.writeFileSync(input, JSON.stringify({ GOOGLE_DRIVE_ARCHIVE_JOB_SECRET: "a".repeat(48), GOOGLE_DRIVE_REFRESH_TOKEN: "not-for-export" }), { mode: 0o600 });
  prepareRunnerConfig(["--config", input, "--output", output, "--curl"]);
  const text = fs.readFileSync(output, "utf8");
  expect(text).toContain('request = "POST"'); expect(text).not.toContain("not-for-export");
  expect(text.split("\n")).toHaveLength(4);
  expect(() => prepareRunnerConfig(["--config", input, "--output", output, "--curl"])).toThrow();
});
it("rejects header injection and relative destinations", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "archive-runner-config-test-")); roots.push(root);
  const input = path.join(root, "input.json");
  fs.writeFileSync(input, JSON.stringify({ GOOGLE_DRIVE_ARCHIVE_JOB_SECRET: "a".repeat(40) + '\nheader = "bad"' }), { mode: 0o600 });
  expect(() => prepareRunnerConfig(["--config", input, "--output", path.join(root, "job.curl"), "--curl"])).toThrow();
  expect(() => prepareRunnerConfig(["--config", input, "--output", "relative", "--curl"])).toThrow();
});
it("rejects the repository root even before input is read", () => {
  const root = path.resolve(__dirname, "../..");
  expect(() => prepareRunnerConfig(["--config", path.join(root, "absent-private.json"), "--output", path.join(root, "must-not-create.curl"), "--curl"])).toThrow("Protected external parent required");
});
