import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260916190000_add_doctor_invitations",
  "migration.sql"
);

describe("Doctor invitation additive migration", () => {
  it("stores only fixed-length hashes and lifecycle metadata without a backfill", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toContain("CREATE TABLE `DoctorInvitation`");
    expect(sql).toContain("`tokenHash` VARCHAR(64) NOT NULL");
    expect(sql).toContain("`creationKeyHash` VARCHAR(64) NOT NULL");
    expect(sql).toContain("UNIQUE INDEX `DoctorInvitation_tokenHash_key`");
    expect(sql).toContain("`expiresAt` DATETIME(3) NOT NULL");
    expect(sql).toContain("`claimedAt` DATETIME(3) NULL");
    expect(sql).toContain("`revokedAt` DATETIME(3) NULL");
    expect(sql).not.toMatch(/^\s*UPDATE\b/im);
    expect(sql).not.toMatch(/rawToken|plainToken|inviteUrl/i);
  });

  it("indexes Admin listing and claim lifecycle lookups", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toContain("DoctorInvitation_createdById_createdAt_idx");
    expect(sql).toContain("DoctorInvitation_claimedById_claimedAt_idx");
    expect(sql).toContain("DoctorInvitation_revokedAt_expiresAt_idx");
    expect(sql).toContain("DoctorInvitation_role_expiresAt_idx");
  });
});
