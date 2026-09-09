import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "prisma/migrations/20260909120000_add_telemedicine_consent_recordings/migration.sql"
);

describe("telemedicine consent and recording migration contract", () => {
  it("binds one consent to one consultation without backfilling or production mutation", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("CREATE TABLE `TelemedicineConsent`");
    expect(sql).toContain("UNIQUE INDEX `TelemedicineConsent_consultationId_key`(`consultationId`)");
    expect(sql).not.toMatch(/INSERT\s+INTO\s+`?TelemedicineConsent/i);
    expect(sql).toContain("CREATE TABLE `ConsultationRecordingWebhookEvent`");
    expect(sql).not.toContain("downloadUrl");
    expect(sql).toContain("ADD COLUMN `retentionUntil` DATETIME(3) NULL");
    expect(sql).toContain("DATE_ADD(`createdAt`, INTERVAL 5 YEAR)");
    const chatAction = readFileSync(path.resolve("features/consultations/chat/actions.ts"), "utf8");
    expect(chatAction).toContain("retentionUntil: getRecordingRetentionUntil(new Date())");
    const legalAction = readFileSync(path.resolve("features/legal/actions.ts"), "utf8");
    expect(legalAction).toContain('document.type === "teleconsultation"');
  });
});
