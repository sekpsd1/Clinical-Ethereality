import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
const migration = readFileSync(
  join(process.cwd(), "prisma", "migrations", "20260914120000_add_community_pinned_articles", "migration.sql"),
  "utf8"
);
const service = readFileSync(
  join(process.cwd(), "features", "community", "pinning", "service.ts"),
  "utf8"
);
const normalizedService = service.replaceAll("\\`", "`");

describe("community pinned articles migration", () => {
  it("adds nullable pin fields, reverse relation, ordering index, and delete-user SetNull safety", () => {
    expect(schema).toMatch(/pinnedArticles\s+Article\[\]\s+@relation\("ArticlePinnedBy"\)/);
    expect(schema).toMatch(/pinnedById\s+String\?/);
    expect(schema).toMatch(/pinnedAt\s+DateTime\?/);
    expect(schema).toMatch(/@relation\("ArticlePinnedBy"[^\n]+onDelete: SetNull\)/);
    expect(schema).toContain('@@index([status, pinnedAt, publishedAt, createdAt], map: "Article_status_pin_publish_idx")');
    expect(migration).toContain("ON DELETE SET NULL");
    expect(migration).toContain("Article_status_pin_publish_idx");
    expect(normalizedService).toContain("FORCE INDEX (`Article_status_pin_publish_idx`)");
    expect(normalizedService).toMatch(/WHERE `status` = 'published'[\s\S]+`pinnedAt` IS NOT NULL[\s\S]+FOR UPDATE/);
  });

  it("does not backfill or mutate existing article rows", () => {
    expect(migration).not.toMatch(/\bUPDATE\s+`?Article`?/i);
    expect(migration).not.toMatch(/DEFAULT\s+CURRENT_TIMESTAMP/i);
  });
});
