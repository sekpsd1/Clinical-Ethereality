import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "prisma",
  "migrations",
  "20260908120000_add_consultation_prescription_outcome",
  "migration.sql"
);

describe("consultation prescription outcome migration", () => {
  it("is additive and defaults every existing consultation to pending doctor summary", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toContain("ADD COLUMN `prescriptionOutcomeStatus`");
    expect(sql).toContain("NOT NULL DEFAULT 'pending_doctor_summary'");
    expect(sql).toContain("ADD COLUMN `prescriptionOutcomeUpdatedAt` DATETIME(3) NULL");
    expect(sql).not.toMatch(/\bUPDATE\b|\bDELETE\b|\bDROP\b|\bTRUNCATE\b|\bMODIFY\b/i);
  });

  it("keeps Prisma aligned with the three approved outcome values", () => {
    const schema = fs.readFileSync(path.resolve("prisma", "schema.prisma"), "utf8");

    expect(schema).toContain("enum ConsultationPrescriptionOutcomeStatus");
    expect(schema).toContain("pending_doctor_summary");
    expect(schema).toContain("prescription_issued");
    expect(schema).toContain("no_prescription");
    expect(schema).toContain("@default(pending_doctor_summary)");
  });

  it("does not expose prescription outcomes on schedule or calendar views", () => {
    const scheduleSources = [
      "features/admin/AdminAppointmentCalendar.tsx",
      "features/admin/AdminSchedules.tsx",
      "features/admin/schedules/queries.ts"
    ].map((file) => fs.readFileSync(path.resolve(file), "utf8"));

    for (const source of scheduleSources) {
      expect(source).not.toContain("prescriptionOutcome");
      expect(source).not.toContain("ผลสรุปใบสั่งยา");
    }
  });
});
