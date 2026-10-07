/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, expect, it } from "vitest";
const { classifyArchiveMigration } = require("../../scripts/plesk-archive-migration-preflight.cjs");
describe("archive migration database gate", () => {
  const source = new Map([["previous", "hash1"], ["archive", "hash2"]]);
  const prior = { name: "previous", checksum: "hash1", finished: true, rolledBack: false };
  it("accepts exactly pending target and idempotently accepts already applied", () => {
    expect(classifyArchiveMigration(source, [prior], "archive")).toBe("pending");
    expect(classifyArchiveMigration(source, [prior, { ...prior, name: "archive", checksum: "hash2" }], "archive")).toBe("ready");
  });
  it("rejects additional pending, unresolved failure, checksum drift, and unknown applied migration", () => {
    expect(classifyArchiveMigration(source, [], "archive")).toBe("blocked");
    expect(classifyArchiveMigration(source, [prior, { ...prior, name: "archive", finished: false }], "archive")).toBe("blocked");
    expect(classifyArchiveMigration(source, [{ ...prior, checksum: "drift" }], "archive")).toBe("blocked");
    expect(classifyArchiveMigration(source, [prior, { ...prior, name: "unknown" }], "archive")).toBe("blocked");
  });
});
