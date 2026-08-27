import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SMS_OTP_SCHEMA_MIGRATIONS } from "@/features/admin/integrations/sms-otp-schema-readiness";

const migrationName = "20260827113000_add_phone_otp_dispatch_claim";
const migrationPath = path.resolve("prisma", "migrations", migrationName, "migration.sql");

describe("phone OTP dispatch claim migration", () => {
  it("is additive, nullable, and contains no data rewrite or destructive statement", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toContain("ALTER TABLE `User`");
    expect(sql).toContain("ADD COLUMN `phoneOtpDispatchClaimedUntil` DATETIME(3) NULL");
    expect(sql).not.toMatch(/\bUPDATE\b|\bDELETE\b|\bDROP\b|\bTRUNCATE\b|\bMODIFY\b/i);
  });

  it("keeps Prisma, Admin readiness, and the guarded Plesk target aligned", () => {
    const schema = fs.readFileSync(path.resolve("prisma", "schema.prisma"), "utf8");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SMS_OTP_MIGRATION_TARGET } = require("../../scripts/plesk-runtime-migration-runner.cjs");

    expect(schema).toContain("phoneOtpDispatchClaimedUntil DateTime? @db.DateTime(3)");
    expect(SMS_OTP_SCHEMA_MIGRATIONS).toContain(migrationName);
    expect(SMS_OTP_MIGRATION_TARGET).toBe(migrationName);
  });
});
