import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Admin application-runtime migration status probe contract", () => {
  it("runs only behind the explicit Admin compliance query trigger", () => {
    const source = fs.readFileSync(path.resolve("app", "admin", "compliance", "page.tsx"), "utf8");

    expect(source).toContain('query.migrationStatusProbe === "1"');
    expect(source).toContain("await runApplicationMigrationStatusProbe()");
    expect(source).not.toMatch(/route\.ts|public\/|api\/migration/i);
  });
});
